import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));
vi.mock("@/lib/api/videos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/videos")>()),
  listVideos: vi.fn(),
}));

import { GlacierHome } from "@/components/glacier/GlacierHome";
import { HomeScreen } from "@/components/mobile/HomeScreen";
import { DrillContext } from "@/components/views/drill-link";
import { HomeWindow } from "@/components/windows/HomeWindow";
import { getLedger, type Ledger } from "@/lib/api/ledger";
import { listVideos, type Video } from "@/lib/api/videos";
import { refreshVideos } from "@/lib/videos/use-videos";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { DueCard } from "./DueCard";

// W2's three originals: roster 12 paid on video, roster 13's two still owed. A W1 ice is late.
const [W2_12, W2_13_LOWEST] = SCENARIO_LEDGER.ices.filter((i) => i.week === 2 && i.reason !== "late");
const W1_LATE = SCENARIO_LEDGER.ices.find((i) => i.week === 1 && i.rosterId === 8)!;
const LEDGER: Ledger = {
  ...SCENARIO_LEDGER,
  ices: SCENARIO_LEDGER.ices
    .filter((i) => i.reason !== "late")
    .map((i) =>
      i.iceId === W2_12.iceId ? { ...i, status: "completed", chugSeconds: 7.2 } : i.iceId === W1_LATE.iceId ? { ...i, status: "owed", completedAt: null } : i,
    ),
};
const VIDEO: Video = { mediaId: "v12", iceIds: [W2_12.iceId], week: 2, rosterIds: [12], createdAt: "2026-09-24T12:00:00+00:00", bytes: 1, url: "https://media.test/v12.mp4" };

beforeEach(() => {
  stubSleeper();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-25T17:00:00Z"));
  vi.mocked(getLedger).mockResolvedValue(LEDGER);
  vi.mocked(listVideos).mockResolvedValue([VIDEO]);
  refreshVideos();
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const card = () => screen.findByRole("region", { name: "Due Sunday" });

describe("Due Sunday card", () => {
  it("counts down to the deadline and lists every team due, paid or owing, with late teams above in red", async () => {
    const drill = vi.fn();
    render(
      <DrillContext value={drill}>
        <DueCard className="xp-group" titleClass="xp-group-title" />
      </DrillContext>,
    );
    const box = within(await card());
    expect((await box.findByText("2d 0h")).className).toBe("due-count");
    expect(box.getByText(/until Week 2 ices are due, Sun, Sep 27 · 1 PM ET/)).toBeTruthy();

    const late = box.getByRole("list", { name: "Late" }).querySelectorAll("li");
    expect([...late].map((li) => [li.getAttribute("data-level"), li.querySelector(".who-owes-due")?.textContent])).toEqual([["late", "LATE"]]);
    expect(late[0].textContent).toMatch(/Team 8.*W1 · /);

    const due = [...box.getByRole("list", { name: "Due Week 2" }).querySelectorAll("li")];
    expect(due.map((li) => li.getAttribute("data-level"))).toEqual(["due", "due", "paid"]);
    expect(due[0].textContent).toMatch(/Team 13.*Owes/);
    expect(due.some((li) => li.textContent?.includes(`lowest score ${W2_13_LOWEST.points!.toFixed(2)}`))).toBe(true);
    expect(due[2].textContent).toMatch(/Team 12.*7\.2s/);

    fireEvent.click(await within(due[2]).findByRole("button", { name: "Play Team 12 week 2 chug" }));
    expect(screen.getByRole("dialog", { name: "Team 12 · Week 2" }).querySelector("video")!.getAttribute("src")).toBe(`${VIDEO.url}#t=0.1`);

    fireEvent.click(box.getByRole("button", { name: "See ledger" }));
    expect(drill).toHaveBeenCalledWith({ kind: "ices", filter: "week-2" });
  });

  it("says everyone is square, with the next deadline, when nothing is due", async () => {
    vi.setSystemTime(new Date("2026-09-28T18:00:00Z"));
    vi.mocked(getLedger).mockResolvedValue({ ...LEDGER, ices: LEDGER.ices.map((i) => ({ ...i, status: "completed" as const })) });
    render(<DueCard className="xp-group" titleClass="xp-group-title" />);
    const box = within(await card());
    expect(await box.findByText("Everyone's square until next week.")).toBeTruthy();
    expect(box.getByText("Next deadline Sun, Oct 4 · 1 PM ET")).toBeTruthy();
    expect(box.queryByRole("list")).toBeNull();
  });

  const HOMES: Record<string, () => ReactNode> = {
    "Glacier Home": () => <GlacierHome />,
    "XP Home window": () => <HomeWindow />,
    "XP phone Home": () => <HomeScreen />,
  };
  it.each(Object.keys(HOMES))("sits near the top of %s", async (home) => {
    const { container } = render(HOMES[home]());
    const due = await card();
    expect(await within(due).findByText("2d 0h")).toBeTruthy();
    const sections = [...container.querySelectorAll("section")].filter((s) => !s.parentElement?.closest("section"));
    expect(sections.indexOf(due)).toBeLessThanOrEqual(1);
  });
});
