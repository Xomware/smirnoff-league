import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));

import { DrillContext } from "@/components/views/drill-link";
import { getLedger } from "@/lib/api/ledger";
import { getMe } from "@/lib/api/users";
import { refreshLedger } from "@/lib/ices/use-ledger";
import { TroubleProvider } from "@/lib/ices/use-trouble";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { IceStandingsScreen } from "./IcesScreen";
import { PlayerScreen } from "./PlayerScreen";
import { StandingsScreen } from "./StandingsScreen";
import { TeamScreen } from "./TeamScreen";

const PROFILE = { name: "Six", username: "six", rosterId: 6, createdAt: "", updatedAt: "" };

beforeEach(() => {
  stubSleeper();
  vi.mocked(getMe).mockResolvedValue({ sub: "s", email: "e", isAdmin: false, profile: PROFILE });
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  refreshLedger();
});
afterEach(() => vi.clearAllMocks());

const renderScreen = (view: ReactNode) =>
  render(
    <ProfileProvider>
      <DrillContext.Provider value={vi.fn()}>{view}</DrillContext.Provider>
    </ProfileProvider>,
  );

const head = (list: HTMLElement) => [...(list.parentElement?.querySelector(".board-head")?.children ?? [])].map((c) => c.textContent);
const nums = (li: HTMLElement) => [...li.querySelectorAll(":scope > .board-num")].map((n) => n.textContent);
const sub = (li: HTMLElement) => li.querySelector(".board-sub")?.textContent;

describe("phone boards", () => {
  it("charts league standings: rank, team, then record and points-for columns, with points against and badges beneath", async () => {
    // Glacier's trouble tags, which XP never shows.
    renderScreen(
      <TroubleProvider on>
        <StandingsScreen />
      </TroubleProvider>,
    );
    const list = await screen.findByRole("list", { name: /League standings/ });
    expect(head(list)).toEqual(["RK", "Team", "W-L", "PF"]);
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(14);
    for (const li of items) {
      expect(li.className).toContain("board-row");
      expect(nums(li)).toHaveLength(2);
      expect(nums(li)[0]).toMatch(/^\d+-\d+(-\d+)?$/);
      expect(nums(li)[1]).toMatch(/^Points for \d+\.\d\d$/);
      expect(li.querySelector(".board-sub > span")?.textContent).toMatch(/^PA Points against \d+\.\d\d$/);
      expect(li.querySelector(".board-name, .xp-team")?.querySelector(".trouble-tag, .ice-badge")).toBeNull();
    }
    expect(items.map((li) => li.querySelector(".board-rank")?.textContent)).toEqual(items.map((_, i) => String(i + 1)));
    expect(list.textContent).not.toContain(" for ·");
    expect(items.filter((li) => li.querySelector(".m-cut"))).toHaveLength(1);
    // SCENARIO_LEDGER's roster 13 owes two late ices: its Late tag sits on the sub line, not beside the name,
    // and stands in for the ice count there.
    const owing = items.find((li) => li.querySelector(".xp-team-name")?.textContent === "Team 13")!;
    expect(await within(owing).findByText("Late")).toBeTruthy();
    expect(within(owing).queryByText("2 ices this season")).toBeNull();
    expect(owing.querySelector(".board-sub .trouble-tag")?.textContent).toBe("Late");
    expect(items.find((li) => li.className.includes("m-mine"))?.textContent).toContain("Team 6");
  });

  it("shows the season ice count on the standings sub line when XP has no trouble tags", async () => {
    renderScreen(<StandingsScreen />);
    const list = await screen.findByRole("list", { name: /League standings/ });
    const owing = within(list).getAllByRole("listitem").find((li) => li.querySelector(".xp-team-name")?.textContent === "Team 13")!;
    expect((await within(owing).findByText("2 ices this season")).closest(".board-sub")).toBeTruthy();
    expect(owing.querySelector(".trouble-tag")).toBeNull();
  });

  it("charts ice standings: rank, team with the breakdown and trouble tag beneath, ices in a column", async () => {
    renderScreen(
      <TroubleProvider on>
        <IceStandingsScreen />
      </TroubleProvider>,
    );
    const list = await screen.findByRole("list", { name: "Ice standings" });
    expect(head(list)).toEqual(["RK", "Team", "Ices"]);
    // The sub-tabs and page description already name the page.
    expect(screen.queryByRole("heading", { name: "Ice standings" })).toBeNull();
    const items = within(list).getAllByRole("listitem");
    for (const li of items) {
      expect(li.className).toContain("board-row");
      expect(nums(li)).toHaveLength(1);
      expect(nums(li)[0]).toMatch(/^\d+ ices?$/);
      expect(li.querySelector(".xp-team .trouble-tag, .xp-team .ice-badge")).toBeNull();
    }
    const late = items.find((li) => li.querySelector(".xp-team-name")?.textContent === "Team 13")!;
    expect((await within(late).findByText("Late")).closest(".board-sub")).toBeTruthy();
  });

  it("charts head-to-head: opponent, then record, for and against columns", async () => {
    renderScreen(<TeamScreen params={{ rosterId: 6, tab: "head-to-head" }} />);
    const list = await screen.findByRole("list", { name: "Head-to-head" });
    expect(head(list)).toEqual(["Opponent", "W-L", "PF", "PA"]);
    const [first, , unplayed] = within(list).getAllByRole("listitem");
    expect(first.textContent).toContain("Team 1");
    expect(nums(first)).toEqual(["0-1", "Points for 114.98", "Points against 182.68"]);
    expect(first.querySelector(".board-sub")).toBeNull();
    expect(unplayed.textContent).toContain("Team 2");
    expect(nums(unplayed)).toEqual([]);
    expect(unplayed.querySelector(".board-none")?.textContent).toBe("Not played");
  });

  it("moves an opponent's trouble tag off the name onto a sub line", async () => {
    renderScreen(
      <TroubleProvider on>
        <TeamScreen params={{ rosterId: 6, tab: "head-to-head" }} />
      </TroubleProvider>,
    );
    const list = await screen.findByRole("list", { name: "Head-to-head" });
    const late = within(list).getAllByRole("listitem").find((li) => li.querySelector(".xp-team-name")?.textContent === "Team 13")!;
    expect((await within(late).findByText("Late")).closest(".board-sub")).toBeTruthy();
    expect(late.querySelector(".xp-team .trouble-tag")).toBeNull();
    const clear = within(list).getAllByRole("listitem").find((li) => li.querySelector(".xp-team-name")?.textContent === "Team 1")!;
    expect(clear.querySelector(".board-sub")).toBeNull();
  });

  it("charts weekly results: week, opponent with the detail beneath, result and score", async () => {
    renderScreen(<TeamScreen params={{ rosterId: 6, tab: "results" }} />);
    const list = await screen.findByRole("list", { name: "Weekly results" });
    expect(head(list)).toEqual(["WK", "Opponent", "", "Pts"]);
    const [w1, w2] = within(list).getAllByRole("listitem");
    expect(w1.className).toContain("board-row");
    expect(within(w1).getByRole("button", { name: "Week 1" }).textContent).toBe("W1Week 1");
    expect(within(w1).getByText("W1").getAttribute("aria-hidden")).toBe("true");
    expect(w1.querySelector(".board-name")?.textContent).toContain("Team 9");
    expect(w1.querySelector(".m-result-pill")?.textContent).toBe("L");
    expect(nums(w1)).toEqual(["91.46 - 134.46"]);
    expect(within(w1).getByText("91.46").className).not.toBe("sr-only");
    expect(sub(w1)).toContain("134.46 against");
    expect(sub(w1)).toContain("8.00 left on the bench");
    expect(sub(w1)).toContain("Romeo Doubs");
    expect(w2.querySelector(".board-name")?.textContent).toContain("Team 1");
    expect(nums(w2)).toEqual(["114.98 - 182.68"]);
    expect(sub(w2)).toMatch(/^182\.68 against/);
  });

  it("charts a player's weeks: week, team with starter or bench beneath, points", async () => {
    renderScreen(<PlayerScreen params={{ playerId: "8121" }} />);
    const list = await screen.findByRole("list", { name: "Week by week" });
    expect(head(list)).toEqual(["WK", "Team", "Pts"]);
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    const w1 = items[0];
    expect(within(w1).getByRole("button", { name: "Week 1" })).toBeTruthy();
    expect(w1.querySelector(".board-name")?.textContent).toContain("Team 6");
    expect(nums(w1)).toEqual(["0.00"]);
    expect(sub(w1)).toBe("Starter · Caused an ice");
  });
});
