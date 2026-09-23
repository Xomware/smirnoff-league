import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { startTracking, track } from "./tracker";

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let stop: (() => void) | null;

const sent = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    url,
    keepalive: init?.keepalive,
    token: new Headers(init?.headers).get("Authorization"),
    events: (JSON.parse(String(init?.body)) as { events: { kind: string; target: string; at: string }[] }).events,
  }));

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: hidden ? "hidden" : "visible" });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token" } } });
  fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: { recorded: 1 }, error: null, meta: null })));
  vi.stubGlobal("fetch", fetchMock);
  stop = null;
});

afterEach(() => {
  stop?.();
  setHidden(false);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("activity tracker", () => {
  it("batches events and flushes them every 30 seconds with the ID token", async () => {
    stop = startTracking();
    track("open", "stats");
    track("drill", "team:6");
    await vi.advanceTimersByTimeAsync(29_000);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    const [call] = sent();
    expect(call.url).toBe("https://api.test/activity/track");
    expect(call.token).toBe("id-token");
    expect(call.keepalive).toBe(true);
    expect(call.events.map((e) => [e.kind, e.target])).toEqual([
      ["signin", ""],
      ["open", "stats"],
      ["drill", "team:6"],
    ]);
    expect(Number.isNaN(Date.parse(call.events[0].at))).toBe(false);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("flushes at once when the tab is hidden", async () => {
    stop = startTracking();
    track("open", "ices");
    setHidden(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(sent()[0].events.map((e) => e.target)).toEqual(["", "ices"]);
  });

  it("records the sign-in once per browser session", async () => {
    stop = startTracking();
    stop();
    // A reload keeps sessionStorage, and the tracker starts again.
    sessionStorage.setItem("smirnoff.activity.signin", "1");
    stop = startTracking();
    track("open", "stats");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sent()[0].events.map((e) => e.kind)).toEqual(["open"]);
  });

  it("sends at most 50 events per request", async () => {
    stop = startTracking();
    for (let i = 0; i < 60; i++) track("open", `week:${i + 1}`);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sent().map((c) => c.events.length)).toEqual([50, 11]);
  });

  it("tracks nothing while signed out", async () => {
    track("open", "stats");
    setHidden(true);
    await vi.advanceTimersByTimeAsync(60_000);

    stop = startTracking();
    stop();
    stop = null;
    track("open", "stats");
    setHidden(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops a failed batch without throwing", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    stop = startTracking();
    await vi.advanceTimersByTimeAsync(30_000);
    track("open", "stats");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sent().map((c) => c.events.map((e) => e.kind))).toEqual([["signin"], ["open"]]);
  });
});
