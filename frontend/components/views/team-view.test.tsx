import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

import { AppShell } from "@/components/phone/AppShell";
import { Desktop } from "@/components/desktop/Desktop";
import { getLedger } from "@/lib/api/ledger";
import { ApiError, getMe } from "@/lib/api/users";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { PHONE } from "@/lib/use-media-query";
import { DrillContext } from "./drill-link";
import { TeamView } from "./team-view";

const PROFILE = { name: "Six", username: "six", rosterId: 6, createdAt: "2026-09-22T12:00:00+00:00", updatedAt: "2026-09-22T12:00:00+00:00" };

function viewport(phone: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: phone && query === PHONE,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

const withDrill = (onOpen: () => void, view: ReactNode) => (
  <DrillContext.Provider value={onOpen}>{view}</DrillContext.Provider>
);
const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => c.textContent);
const openTab = (name: string, root: Pick<typeof screen, "getByRole"> = screen) => fireEvent.click(root.getByRole("tab", { name }));

beforeEach(() => {
  stubSleeper();
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  vi.mocked(getMe).mockResolvedValue({ sub: "s6", email: "six@example.com", isAdmin: false, profile: PROFILE });
  Element.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("Manager profile", () => {
  it("heads roster 6 with manager, record, points, rank and its ledger totals", async () => {
    render(<TeamView rosterId={6} />);

    const head = await screen.findByRole("region", { name: "Team 6" });
    expect(within(head).getByRole("heading", { name: "Team 6" })).toBeTruthy();
    expect(within(head).getByText("user6")).toBeTruthy();
    const stat = (term: string) => within(head).getByText(term).nextElementSibling?.textContent;
    expect(stat("Record")).toBe("1-1");
    expect(stat("PF / PA")).toBe("194.00 / 0.00");
    expect(stat("Rank")).toContain("6th of 14");
    expect(stat("Rank")).toContain("Danger zone");
    await waitFor(() => expect(stat("Ices")).toBe("0 owed · 2 completed · 0 late"));
    expect(within(head).queryByRole("img", { name: "Your team" })).toBeNull();
  });

  it("shows week-by-week results with margin, bench points and ices, and charts them against the league", async () => {
    const onOpen = vi.fn();
    render(withDrill(onOpen, <TeamView rosterId={6} />));

    const results = await screen.findByRole("table", { name: "Weekly results" });
    const [, w1, w2] = within(results).getAllByRole("row");
    expect(cells(w1)[1]).toContain("Team 9");
    expect(cells(w1).slice(2, 6)).toEqual(["91.46 - 134.46", "L", "-43.00", "8.00"]);
    expect(cells(w1)[6]).toContain("Romeo Doubs");
    expect(cells(w1)[6]).toContain("Lowest score");
    expect(cells(w2)[1]).toContain("Team 1");
    expect(cells(w2).slice(2, 5)).toEqual(["114.98 - 182.68", "L", "-67.70"]);
    expect(screen.getByRole("img", { name: /Points per week.*League average: W1 130\.95, W2 116\.46/ })).toBeTruthy();

    fireEvent.click(within(w1).getByRole("button", { name: /Team 9/ }));
    expect(onOpen).toHaveBeenLastCalledWith({ kind: "team", rosterId: 9 });
  });

  it("lists the W1 ices from the ledger, each drilling to its player", async () => {
    const onOpen = vi.fn();
    render(withDrill(onOpen, <TeamView rosterId={6} />));
    await screen.findByRole("table", { name: "Weekly results" });
    openTab("Ices");

    const ices = await screen.findByRole("table", { name: "Season ices" });
    const rows = within(ices).getAllByRole("row").slice(1);
    expect(rows.map((r) => cells(r).slice(0, 5))).toEqual([
      ["Week 1", "Lowest score", "-", "Completed", "Sep 19"],
      ["Week 1", "Zero points", "Romeo Doubs", "Completed", "Sep 19"],
    ]);
    fireEvent.click(within(rows[1]).getByRole("button", { name: "Romeo Doubs" }));
    expect(onOpen).toHaveBeenLastCalledWith({ kind: "player", playerId: "8121" });
  });

  it("puts late ices under their parent", async () => {
    render(<TeamView rosterId={13} />);
    await screen.findByRole("table", { name: "Weekly results" });
    openTab("Ices");

    const rows = within(await screen.findByRole("table", { name: "Season ices" })).getAllByRole("row").slice(1);
    expect(rows.map((r) => cells(r)[1])).toEqual(["Lowest score", "Late ice 1", "Zero points", "Late ice 1"]);
    expect(rows.map((r) => cells(r)[3])).toEqual(["Owed", "Owed", "Owed", "Owed"]);
  });

  it("falls back to Sleeper's ices, marked provisional, when the ledger fails", async () => {
    vi.mocked(getLedger).mockRejectedValue(new ApiError(500, "Internal error"));
    render(<TeamView rosterId={6} />);
    await screen.findByRole("table", { name: "Weekly results" });
    openTab("Ices");

    expect((await screen.findByRole("note")).textContent).toMatch(/ledger unavailable \(internal error\)/i);
    const rows = within(screen.getByRole("table", { name: "Season ices" })).getAllByRole("row").slice(1);
    expect(rows.map((r) => cells(r)[3])).toEqual(["Provisional", "Provisional"]);
  });

  it("shows transactions, head-to-head records and the roster with season points", async () => {
    const onOpen = vi.fn();
    render(withDrill(onOpen, <TeamView rosterId={6} />));
    await screen.findByRole("table", { name: "Weekly results" });

    openTab("Transactions");
    const moves = await screen.findByRole("table", { name: "Transactions" });
    const [move] = within(moves).getAllByRole("row").slice(1);
    expect(cells(move)).toEqual(["Week 3", "Free agent", "Rashod Bateman", "Alec Pierce"]);

    openTab("Head-to-head");
    const h2h = screen.getByRole("table", { name: "Head-to-head" });
    const rows = within(h2h).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(13);
    expect(cells(rows[0])[0]).toContain("Team 1");
    expect(cells(rows[0]).slice(1)).toEqual(["0-1", "114.98", "182.68"]);
    expect(cells(rows[2])[0]).toContain("Team 2");
    expect(cells(rows[2]).slice(1)).toEqual(["-", "-", "-"]);
    fireEvent.click(within(rows[2]).getByRole("button", { name: /Team 2/ }));
    expect(onOpen).toHaveBeenLastCalledWith({ kind: "team", rosterId: 2 });

    openTab("Roster");
    const starters = screen.getByRole("list", { name: "Starters, week 2" });
    expect(within(starters).getAllByRole("listitem")).toHaveLength(10);
    const bench = screen.getByRole("list", { name: "Bench, week 2" });
    expect(within(bench).getAllByRole("listitem")).toHaveLength(6);
    expect(within(starters).getByText("Romeo Doubs").closest("li")?.textContent).toContain("12.60");
  });
});

describe("My Team", () => {
  it("opens your claimed roster from the desktop icon, starred as yours", async () => {
    render(
      <ProfileProvider>
        <DesktopProvider>
          <Desktop />
        </DesktopProvider>
      </ProfileProvider>,
    );
    fireEvent.doubleClick(screen.getByRole("button", { name: "My Team" }));

    const win = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('section[aria-label="My Team - Team 6"]');
      expect(found).toBeTruthy();
      return found!;
    });
    const head = await within(win).findByRole("region", { name: "Team 6" });
    expect(within(head).getByRole("img", { name: "Your team" })).toBeTruthy();
  });

  it("is a phone tab that opens your roster", async () => {
    viewport(true);
    render(
      <ProfileProvider>
        <DesktopProvider>
          <AppShell />
        </DesktopProvider>
      </ProfileProvider>,
    );
    const tabs = within(screen.getByRole("navigation", { name: "Tabs" }));
    fireEvent.click(tabs.getByRole("button", { name: "My Team" }));

    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("My Team - Team 6"));
    expect(await screen.findByRole("region", { name: "Team 6" })).toBeTruthy();
  });
});

describe("scenario", () => {
  it("opens another team from Standings and walks its W1-W2 results, ices and transactions", async () => {
    render(
      <DesktopProvider>
        <Desktop />
      </DesktopProvider>,
    );
    const win = document.querySelector<HTMLElement>('section[aria-label="League Standings"]')!;
    fireEvent.click((await within(win).findByText("Team 6")).closest("button")!);

    const results = await within(win).findByRole("table", { name: "Weekly results" });
    expect(within(results).getAllByRole("row").slice(1).map((r) => cells(r)[0])).toEqual(["Week 1", "Week 2"]);

    openTab("Ices", within(win));
    const ices = await within(win).findByRole("table", { name: "Season ices" });
    const players = within(ices).getAllByRole("button").filter((b) => !b.textContent?.startsWith("Week"));
    expect(players.map((b) => b.textContent)).toEqual(["Romeo Doubs"]);
    expect(within(ices).getAllByRole("row").slice(1).every((r) => cells(r)[0] === "Week 1")).toBe(true);

    openTab("Transactions", within(win));
    expect(within(await within(win).findByRole("table", { name: "Transactions" })).getByText("Rashod Bateman")).toBeTruthy();

    openTab("Ices", within(win));
    fireEvent.click(within(await within(win).findByRole("table", { name: "Season ices" })).getByRole("button", { name: "Romeo Doubs" }));
    expect(await within(win).findByRole("heading", { name: "Romeo Doubs" })).toBeTruthy();
  });
});
