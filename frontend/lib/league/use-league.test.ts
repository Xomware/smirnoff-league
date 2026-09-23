import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubSleeper } from "@/lib/test/league-mock";
import { useDefaultWeek } from "./default-week";
import { useLeague } from "./use-league";

const calls = (path: string) =>
  vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith(path)).length;

// Sleeper rolls over to week 4 on the next nfl/state read.
function advanceSleeperToWeek4() {
  const sleeper = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) =>
    String(input).endsWith("/state/nfl")
      ? new Response(JSON.stringify({ week: 4, display_week: 4, season: "2026", season_type: "regular", leg: 4 }))
      : sleeper(input, init),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  stubSleeper();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useLeague", () => {
  it("polls the live week and refetches it on refresh()", async () => {
    const { result } = renderHook(() => useLeague(3));
    await vi.waitFor(() => expect(result.current.matchups).toEqual([]));
    expect(calls("/matchups/3")).toBe(1);

    act(() => vi.advanceTimersByTime(60_000));
    await vi.waitFor(() => expect(calls("/matchups/3")).toBe(2));

    act(() => result.current.refresh());
    await vi.waitFor(() => expect(calls("/matchups/3")).toBe(3));
  });

  it("fetches a finished week once, without polling", async () => {
    const { result } = renderHook(() => useLeague(1));
    await vi.waitFor(() => expect(result.current.matchups).toHaveLength(14));

    act(() => vi.advanceTimersByTime(5 * 60_000));
    const second = renderHook(() => useLeague(1));
    await vi.waitFor(() => expect(second.result.current.matchups).toHaveLength(14));
    expect(calls("/matchups/1")).toBe(1);
    expect(calls("/users")).toBe(1);
  });

  it("shares one nfl/state request across hooks and re-reads it every 5 minutes", async () => {
    const { result } = renderHook(() => ({ a: useLeague(), b: useLeague(3), week: useDefaultWeek() }));
    await vi.waitFor(() => expect(result.current.week).toBe(3));
    await vi.waitFor(() => expect(result.current.a.data?.nfl.week).toBe(3));
    expect(calls("/state/nfl")).toBe(1);

    act(() => vi.advanceTimersByTime(5 * 60_000));
    await vi.waitFor(() => expect(calls("/state/nfl")).toBe(2));
  });

  it("re-reads nfl/state once when the tab comes back into view", async () => {
    const { result } = renderHook(() => ({ a: useLeague(), week: useDefaultWeek() }));
    await vi.waitFor(() => expect(result.current.a.data).not.toBeNull());
    advanceSleeperToWeek4();

    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    await vi.waitFor(() => expect(result.current.a.data?.nfl.week).toBe(4));
    await vi.waitFor(() => expect(result.current.week).toBe(4));
    expect(calls("/state/nfl")).toBe(2);
  });

  it("stops polling a week once Sleeper moves past it", async () => {
    const { result } = renderHook(() => useLeague(3));
    await vi.waitFor(() => expect(result.current.matchups).toEqual([]));
    advanceSleeperToWeek4();

    act(() => vi.advanceTimersByTime(5 * 60_000));
    await vi.waitFor(() => expect(result.current.data?.nfl.week).toBe(4));
    const settled = calls("/matchups/3");

    act(() => vi.advanceTimersByTime(3 * 60_000));
    expect(calls("/matchups/3")).toBe(settled);
    expect(result.current.matchups).toEqual([]);
  });
});
