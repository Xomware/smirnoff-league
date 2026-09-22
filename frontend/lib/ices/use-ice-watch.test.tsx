import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { espnEvent, jsonResponse } from "@/lib/test/espn-mock";
import { POLL_MS, useIceWatch } from "./use-ice-watch";

let events: ReturnType<typeof espnEvent>[] = [];
let hidden = false;
let fetchMock: MockInstance<typeof fetch>;

const espnCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("espn.com")).length;
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

const live = espnEvent({ home: "MIA", away: "BUF", status: "STATUS_IN_PROGRESS", period: 3, clock: "4:12" });
const done = espnEvent({ home: "MIA", away: "BUF", status: "STATUS_FINAL", period: 4 });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-09-27T15:00:00Z"));
  hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    jsonResponse(String(url).includes("espn.com") ? { events } : []),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useIceWatch polling", () => {
  it("polls while a game is in progress and stops once every game is final", async () => {
    events = [live];
    const { result } = renderHook(() => useIceWatch(3));
    await flush();
    expect(espnCalls()).toBe(1);
    expect(result.current.games?.[0].state).toBe("in");

    await advance(POLL_MS);
    expect(espnCalls()).toBe(2);

    events = [done];
    await advance(POLL_MS);
    expect(espnCalls()).toBe(3);
    expect(result.current.games?.[0].completed).toBe(true);

    await advance(POLL_MS * 10);
    expect(espnCalls()).toBe(3);
  });

  it("does not poll before kickoff, then wakes at the next kickoff", async () => {
    events = [espnEvent({ home: "MIA", away: "BUF", date: "2026-09-27T17:00Z" })];
    renderHook(() => useIceWatch(3));
    await flush();

    await advance(POLL_MS * 3);
    expect(espnCalls()).toBe(1);

    events = [live];
    await advance(2 * 60 * 60 * 1000 - POLL_MS * 3 - 1);
    expect(espnCalls()).toBe(1);
    await advance(1);
    expect(espnCalls()).toBe(2);

    await advance(POLL_MS);
    expect(espnCalls()).toBe(3);
  });

  it("pauses while the tab is hidden and refetches when it is shown", async () => {
    events = [live];
    renderHook(() => useIceWatch(3));
    await flush();

    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    await advance(POLL_MS * 3);
    expect(espnCalls()).toBe(1);

    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(espnCalls()).toBe(2);

    await advance(POLL_MS);
    expect(espnCalls()).toBe(3);
  });

  it("stops polling on unmount", async () => {
    events = [live];
    const { unmount } = renderHook(() => useIceWatch(3));
    await flush();
    unmount();

    await advance(POLL_MS * 3);
    expect(espnCalls()).toBe(1);
  });
});
