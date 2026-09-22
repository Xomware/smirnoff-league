import { afterEach, describe, expect, it, vi } from "vitest";

import { stubSleeper } from "@/lib/test/league-mock";
import { leagueMatchups, nflState, users } from "./cache";

const calls = (path: string) =>
  vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith(path)).length;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("league cache", () => {
  it("dedupes concurrent calls into one request", async () => {
    stubSleeper();
    const [a, b] = await Promise.all([users(), users()]);

    expect(a).toBe(b);
    expect(calls("/users")).toBe(1);
    await users();
    expect(calls("/users")).toBe(1);
  });

  it("evicts a rejected request so the next call retries", async () => {
    stubSleeper();
    vi.mocked(fetch).mockResolvedValueOnce(new Response("down", { status: 500 }));

    await expect(users()).rejects.toThrow(/500/);
    expect((await users()).length).toBe(14);
    expect(calls("/users")).toBe(2);
  });

  it("keeps finished weeks for the session and expires the live week and nfl state", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    stubSleeper();
    await Promise.all([leagueMatchups(1, false), leagueMatchups(3, true), nflState()]);

    vi.advanceTimersByTime(60_000);
    await Promise.all([leagueMatchups(1, false), leagueMatchups(3, true), nflState()]);
    expect(calls("/matchups/1")).toBe(1);
    expect(calls("/matchups/3")).toBe(2);
    expect(calls("/state/nfl")).toBe(1);

    vi.advanceTimersByTime(5 * 60_000);
    await nflState();
    expect(calls("/state/nfl")).toBe(2);
  });
});
