import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  // The ledger shows completion dates in league time; pin the picker's zone too.
  process.env.TZ = "America/New_York";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { Desktop } from "@/components/desktop/Desktop";
import { LeagueScreen } from "@/components/mobile/LeagueScreen";
import { IcesWindow } from "@/components/windows/IcesWindow";
import { Taskbar } from "@/components/xp/Taskbar";
import { AlertsProvider } from "@/lib/alerts/alerts";
import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { ControlPanelWindow } from "./ControlPanel";

const API = "https://api.test";
const W3_ICE: LedgerIce = { iceId: "W03#R06#ADMIN1", week: 3, rosterId: 6, reason: "admin", status: "owed", note: "Skipped the chug" };

let ledger: Ledger;
let isAdmin: boolean;
let adminReply: (path: string, body: Record<string, unknown>) => Response | Promise<Response>;
let adminCalls: { path: string; body: Record<string, unknown>; token: string | null }[];

const envelope = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data, error: null, meta: null }), { status });

beforeEach(() => {
  ledger = structuredClone({
    ...SCENARIO_LEDGER,
    ices: [...SCENARIO_LEDGER.ices, W3_ICE],
    weeks: [...SCENARIO_LEDGER.weeks, { week: 3, finalizedAt: "2026-09-29T08:00:00+00:00", deadlineUtc: "2026-10-04T17:00:00+00:00" }],
  });
  isAdmin = true;
  adminCalls = [];
  adminReply = () => envelope({});
  fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token" } } });
  stubSleeper();
  const sleeper = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    if (!url.startsWith(API)) return sleeper(input, init);
    const path = url.slice(API.length);
    if (path === "/users/me") {
      const profile = { name: "Commish", username: "c", rosterId: 6, createdAt: "", updatedAt: "" };
      return envelope({ sub: "s", email: "e", profile, isAdmin });
    }
    if (path === "/ledger/get") return envelope(structuredClone(ledger));
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    adminCalls.push({ path, body, token: new Headers(init?.headers).get("Authorization") });
    return adminReply(path, body);
  });
  Element.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

async function renderPanel(panel?: string) {
  render(
    <ProfileProvider>
      <AlertsProvider>
        <ControlPanelWindow params={panel ? { panel } : {}} />
        <IcesWindow />
      </AlertsProvider>
    </ProfileProvider>,
  );
  // The panel renders once /users/me says admin.
  if (isAdmin) await screen.findByRole("navigation", { name: "Control Panel categories" });
}

const panel = () => within(document.querySelector<HTMLElement>(".cp")!);
const iceRow = async (name: RegExp) => panel().findByRole("listitem", { name });
const dialog = () => screen.findByRole("alertdialog");
const choose = async (button: string) => fireEvent.click(within(await dialog()).getByRole("button", { name: button }));

describe("Control Panel visibility", () => {
  it("has no desktop icon, Start entry or phone League row for a non-admin", async () => {
    isAdmin = false;
    render(
      <ProfileProvider>
        <DesktopProvider>
          <Desktop />
          <Taskbar />
        </DesktopProvider>
        <LeagueScreen />
      </ProfileProvider>,
    );
    await act(() => new Promise((done) => setTimeout(done, 0)));
    fireEvent.click(screen.getByRole("button", { name: /start/i, expanded: false }));

    expect(screen.queryByRole("button", { name: /^Control Panel/ })).toBeNull();
  });

  it("shows all three entries to an admin", async () => {
    render(
      <ProfileProvider>
        <DesktopProvider>
          <Desktop />
          <Taskbar />
        </DesktopProvider>
        <LeagueScreen />
      </ProfileProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /start/i, expanded: false }));

    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Control Panel/ })).toHaveLength(3));
  });

  it("refuses a non-admin who deep-links to it", async () => {
    isAdmin = false;
    await renderPanel("ices");
    expect(await screen.findByText(/only for league admins/i)).toBeTruthy();
    expect(adminCalls).toEqual([]);
  });

  it("opens each category from the category view", async () => {
    await renderPanel();
    for (const name of ["Ices", "Week Rules", "Toilet Bowl"]) {
      expect(await panel().findByRole("button", { name: new RegExp(`^${name}`) })).toBeTruthy();
    }
  });
});

describe("Ices panel", () => {
  it("marks a W3 ice complete, backdated, and the Ice Ledger shows it after the refetch", async () => {
    adminReply = (_, body) => {
      ledger.ices = ledger.ices.map((i) => (i.iceId === body.iceId ? { ...i, status: "completed", completedAt: String(body.at) } : i));
      return envelope({});
    };
    await renderPanel("ices");

    fireEvent.change(await panel().findByLabelText("Filter by week"), { target: { value: "3" } });
    const row = await iceRow(/W3 Team 6/);
    fireEvent.change(within(row).getByLabelText("Completed at"), { target: { value: "2026-09-26T14:30" } });
    fireEvent.click(within(row).getByRole("button", { name: "Complete" }));

    await waitFor(() => expect(adminCalls).toHaveLength(1));
    expect(adminCalls[0]).toEqual({
      path: "/admin/ice-complete",
      body: { iceId: "W03#R06#ADMIN1", completed: true, at: "2026-09-26T18:30:00.000Z" },
      token: "id-token",
    });
    const week3 = await screen.findByRole("region", { name: "Week 3" });
    await waitFor(() => expect(within(week3).getByText("Completed Sep 26")).toBeTruthy());
    expect(within(await iceRow(/W3 Team 6/)).getByRole("button", { name: "Undo" })).toBeTruthy();
  });

  it("completes now when no time is picked", async () => {
    await renderPanel("ices");
    fireEvent.change(await panel().findByLabelText("Filter by week"), { target: { value: "3" } });
    fireEvent.click(within(await iceRow(/W3 Team 6/)).getByRole("button", { name: "Complete" }));

    await waitFor(() => expect(adminCalls[0]?.body).toEqual({ iceId: "W03#R06#ADMIN1", completed: true }));
  });

  it("undoes a completion only after the confirm dialog", async () => {
    await renderPanel("ices");
    fireEvent.change(await panel().findByLabelText("Filter by week"), { target: { value: "1" } });
    fireEvent.change(panel().getByLabelText("Filter by team"), { target: { value: "2" } });
    const row = await iceRow(/W1 Team 2/);

    fireEvent.click(within(row).getByRole("button", { name: "Undo" }));
    await choose("Cancel");
    fireEvent.click(within(row).getByRole("button", { name: "Undo" }));
    await choose("Undo");

    await waitFor(() => expect(adminCalls).toHaveLength(1));
    expect(adminCalls[0]).toMatchObject({ path: "/admin/ice-complete", body: { iceId: "W01#R02#S5", completed: false } });
  });

  it("sets a chug time in seconds and shows it as m:ss", async () => {
    await renderPanel("ices");
    fireEvent.change(await panel().findByLabelText("Filter by week"), { target: { value: "3" } });
    const row = await iceRow(/W3 Team 6/);
    fireEvent.change(within(row).getByLabelText("Chug seconds"), { target: { value: "67.5" } });
    expect(within(row).getByText("1:07.50")).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: "Save chug time" }));

    await waitFor(() => expect(adminCalls).toHaveLength(1));
    expect(adminCalls[0]).toMatchObject({ path: "/admin/chug-time", body: { iceId: "W03#R06#ADMIN1", seconds: 67.5 }, token: "id-token" });
  });

  it("voids with a note only after the confirm dialog, and drops the row at once", async () => {
    adminReply = () => new Promise<Response>(() => {});
    await renderPanel("ices");
    fireEvent.change(await panel().findByLabelText("Filter by week"), { target: { value: "3" } });
    const row = await iceRow(/W3 Team 6/);

    fireEvent.click(within(row).getByRole("button", { name: "Void" }));
    fireEvent.change(within(row).getByLabelText("Reason for voiding"), { target: { value: "Scoring fix" } });
    fireEvent.click(within(row).getByRole("button", { name: "Void ice" }));
    await choose("Cancel");
    expect(adminCalls).toEqual([]);

    fireEvent.click(within(row).getByRole("button", { name: "Void ice" }));
    await choose("Void");

    await waitFor(() => expect(adminCalls).toHaveLength(1));
    expect(adminCalls[0]).toMatchObject({ path: "/admin/ice-adjust", body: { action: "void", iceId: "W03#R06#ADMIN1", note: "Scoring fix" } });
    expect(panel().queryByRole("listitem", { name: /W3 Team 6/ })).toBeNull();
  });

  it("adds an admin ice for a week and team", async () => {
    await renderPanel("ices");
    const form = within(await panel().findByRole("form", { name: "Add ice" }));
    fireEvent.change(await form.findByLabelText("Week"), { target: { value: "2" } });
    fireEvent.change(form.getByLabelText("Team"), { target: { value: "8" } });
    fireEvent.change(form.getByLabelText("Note"), { target: { value: "Missed the deadline" } });
    fireEvent.click(form.getByRole("button", { name: "Add ice" }));

    await waitFor(() => expect(adminCalls).toHaveLength(1));
    expect(adminCalls[0]).toMatchObject({
      path: "/admin/ice-adjust",
      body: { action: "add", week: 2, rosterId: 8, note: "Missed the deadline" },
      token: "id-token",
    });
  });

  it("shows the server's message in an error dialog and puts the row back", async () => {
    adminReply = () =>
      new Response(JSON.stringify({ data: null, error: { handler: "admin_ice_complete", message: "W03#R06#ADMIN1 is voided" }, meta: null }), {
        status: 409,
      });
    await renderPanel("ices");
    fireEvent.change(await panel().findByLabelText("Filter by week"), { target: { value: "3" } });
    fireEvent.click(within(await iceRow(/W3 Team 6/)).getByRole("button", { name: "Complete" }));

    expect(within(await dialog()).getByText("W03#R06#ADMIN1 is voided")).toBeTruthy();
    await waitFor(() => expect(within(panel().getByRole("listitem", { name: /W3 Team 6/ })).getByRole("button", { name: "Complete" })).toBeTruthy());
  });
});

describe("Week Rules panel", () => {
  it("saves a rule change on a finalized week, then re-finalizes when asked", async () => {
    await renderPanel("rules");
    fireEvent.click(await panel().findByLabelText("Week 2 ice rules active"));

    await choose("Re-finalize");
    await waitFor(() => expect(adminCalls).toHaveLength(2));
    expect(adminCalls.map(({ path, body }) => ({ path, body }))).toEqual([
      { path: "/admin/settings", body: { week: 2, iceRulesActive: false } },
      { path: "/admin/finalize", body: { week: 2, refinalize: true } },
    ]);
  });

  it("does not re-finalize when the prompt is declined", async () => {
    await renderPanel("rules");
    fireEvent.change(await panel().findByLabelText("Week 1 lowest score scope"), { target: { value: "played" } });

    await choose("Later");
    expect(adminCalls.map((c) => c.body)).toEqual([{ week: 1, lowestScope: "played" }]);
  });

  it("changes an open week without a prompt and finalizes it on demand", async () => {
    await renderPanel("rules");
    fireEvent.change(await panel().findByLabelText("Week 5 lowest score scope"), { target: { value: "played" } });
    fireEvent.click(panel().getByRole("button", { name: "Finalize week 5" }));

    await waitFor(() => expect(adminCalls).toHaveLength(2));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(adminCalls.map((c) => c.body)).toEqual([{ week: 5, lowestScope: "played" }, { week: 5 }]);
  });

  it("re-finalizes only after the confirm dialog", async () => {
    await renderPanel("rules");
    fireEvent.click(await panel().findByRole("button", { name: "Re-finalize week 1" }));
    await choose("Cancel");
    expect(adminCalls).toEqual([]);

    fireEvent.click(panel().getByRole("button", { name: "Re-finalize week 1" }));
    await choose("Re-finalize");
    await waitFor(() => expect(adminCalls.map((c) => c.body)).toEqual([{ week: 1, refinalize: true }]));
  });

  it("shows the ledger's stored rules rather than the defaults", async () => {
    ledger.weeks[1] = { ...ledger.weeks[1], iceRulesActive: false, lowestScope: "played" };
    await renderPanel("rules");
    const active = (await panel().findByLabelText("Week 2 ice rules active")) as HTMLInputElement;
    expect(active.checked).toBe(false);
    expect((panel().getByLabelText("Week 2 lowest score scope") as HTMLSelectElement).value).toBe("played");
    expect((panel().getByLabelText("Week 15 ice rules active") as HTMLInputElement).checked).toBe(false);
  });
});

describe("Toilet Bowl panel", () => {
  it("defaults to byes for seeds 13 and 14 and saves a new pair", async () => {
    await renderPanel("toilet");
    const first = (await panel().findByLabelText("First bye")) as HTMLSelectElement;
    const second = panel().getByLabelText("Second bye") as HTMLSelectElement;
    expect([first.value, second.value]).toEqual(["13", "14"]);

    fireEvent.change(first, { target: { value: "9" } });
    fireEvent.change(second, { target: { value: "12" } });
    fireEvent.click(panel().getByRole("button", { name: "Save byes" }));

    await waitFor(() => expect(adminCalls).toHaveLength(1));
    expect(adminCalls[0]).toMatchObject({ path: "/admin/settings", body: { toiletByes: [9, 12] }, token: "id-token" });
  });

  it("will not save the same seed twice", async () => {
    await renderPanel("toilet");
    fireEvent.change(await panel().findByLabelText("First bye"), { target: { value: "14" } });
    expect((panel().getByRole("button", { name: "Save byes" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
