import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubSleeper } from "@/lib/test/league-mock";
import { useLeague } from "./use-league";

const calls = (path: string) =>
  vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith(path)).length;

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
});
