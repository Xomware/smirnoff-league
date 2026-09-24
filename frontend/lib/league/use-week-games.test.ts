import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLOTS } from "@/lib/ices/compute";
import { espnEvent, jsonResponse } from "@/lib/test/espn-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { useWeekGames } from "./use-week-games";

// Every starter is the BUF defense, whose id is its team, so each has a game; roster 1 leaves its TE slot empty.
const lineup = (rosterId: number, emptyTe: boolean) => {
  const starters = SLOTS.map((_, i) => (emptyTe && i === 5 ? "0" : "BUF"));
  return { roster_id: rosterId, matchup_id: 1, points: 0, starters, starters_points: SLOTS.map(() => 0), players: starters };
};

function stubWeek3(status: string) {
  stubSleeper();
  const sleeper = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes("espn.com")) return jsonResponse({ events: [espnEvent({ home: "BUF", away: "MIA", status })] });
    if (url.endsWith("/matchups/3")) return jsonResponse([lineup(1, true), lineup(2, false)]);
    return sleeper(input, init);
  });
}

async function emptyTe(status: string) {
  stubWeek3(status);
  const { result } = renderHook(() => useWeekGames(3));
  await vi.waitFor(() => expect(result.current.games?.[0].sides[0].starters?.[5].watch).toBeTruthy());
  const side = result.current.games![0].sides.find((s) => s.rosterId === 1)!;
  return { side, te: side.starters![5] };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-24T17:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useWeekGames in the live week", () => {
  it("leaves an empty slot open, and out of the ice count, before kickoff", async () => {
    const { side, te } = await emptyTe("STATUS_SCHEDULED");
    expect(te.watch?.state).toBe("OPEN");
    expect(te.iced).toBe(false);
    expect(side.ices).toBe(0);
    expect(side.iceList).toEqual([]);
  });

  it("counts the empty slot once every game has kicked off", async () => {
    const { side, te } = await emptyTe("STATUS_IN_PROGRESS");
    expect(te.watch?.state).toBe("LOCKED");
    expect(te.iced).toBe(true);
    expect(side.ices).toBe(1);
    expect(side.iceList.map((i) => i.reason)).toEqual(["empty"]);
  });
});
