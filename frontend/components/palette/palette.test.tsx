import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/activity/tracker", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/activity/tracker")>();
  return { ...real, track: vi.fn(real.track) };
});
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));
vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));

import { AppShell } from "@/components/AppShell";
import { track } from "@/lib/activity/tracker";
import { AlertsProvider } from "@/lib/alerts/alerts";
import { getLedger } from "@/lib/api/ledger";
import { getMe } from "@/lib/api/users";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { isMuted, setMuted } from "@/lib/sound/sound";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";

const BUCKY = 5;

function me(rosterId: number, isAdmin = false) {
  vi.mocked(getMe).mockResolvedValue({
    sub: "s",
    email: "e",
    isAdmin,
    profile: { name: "Me", username: "m", rosterId, createdAt: "", updatedAt: "" },
  });
}

function phone(on: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: on && query.includes("max-width"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

function renderShell() {
  return render(
    <ProfileProvider>
      <AlertsProvider>
        <DesktopProvider>
          <AppShell />
        </DesktopProvider>
      </AlertsProvider>
    </ProfileProvider>,
  );
}

const cmdK = (target: Element = document.body, init: KeyboardEventInit = { metaKey: true }) =>
  fireEvent.keyDown(target, { key: "k", ...init });
const box = () => screen.getByRole("combobox", { name: "Search" });
const queryBox = () => screen.queryByRole("combobox", { name: "Search" });
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });
const options = () => within(screen.getByRole("listbox")).getAllByRole("option");
const active = () => document.getElementById(box().getAttribute("aria-activedescendant")!);
const windowNamed = (name: string) => document.querySelector<HTMLElement>(`section[aria-label="${name}"]`);

// Waits for the league so team, player and game results exist.
async function search(text: string) {
  type(text);
  await waitFor(() => expect(options().length).toBeGreaterThan(0));
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  stubSleeper();
  const base = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const res = await base(input, init);
    if (!String(input).endsWith("/users")) return res;
    const users: { user_id: string; metadata: { team_name: string } }[] = await res.json();
    for (const u of users) if (u.user_id === `u${BUCKY}`) u.metadata.team_name = "Bucky's Badgers";
    return new Response(JSON.stringify(users));
  });
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  me(13);
  phone(false);
});
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  setMuted(false);
  window.history.replaceState(null, "", "/");
});

describe("opening and closing", () => {
  it("opens on Cmd+K or Ctrl+K and closes on Esc, handing focus back", () => {
    renderShell();
    const opener = screen.getByRole("button", { name: "Search" });
    opener.focus();
    cmdK(opener);
    expect(document.activeElement).toBe(box());
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(queryBox()).toBeNull();
    expect(document.activeElement).toBe(opener);

    cmdK(document.body, { ctrlKey: true });
    expect(queryBox()).not.toBeNull();
    cmdK(box());
    expect(queryBox()).toBeNull();
  });

  it("ignores Cmd+K typed into another input", () => {
    renderShell();
    const other = document.body.appendChild(document.createElement("input"));
    cmdK(other);
    expect(queryBox()).toBeNull();
    other.remove();
  });

  it("opens from the round search button", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("dialog", { name: "Search" })).toBeTruthy();
  });
});

describe("results", () => {
  it("groups results under headings, best group first", async () => {
    renderShell();
    cmdK();
    type("team");
    const groups = () => within(screen.getByRole("listbox")).getAllByRole("group");
    const names = () => groups().map((g) => document.getElementById(g.getAttribute("aria-labelledby")!)!.textContent);
    await waitFor(() => expect(names()).toContain("Games"));
    expect(names()[0]).toBe("Teams");
    const [teams] = groups();
    expect(within(teams).getAllByRole("option")).toHaveLength(8);
  });

  it("moves through results with the arrow keys and wraps", async () => {
    renderShell();
    cmdK();
    await search("ice");
    const all = options();
    expect(active()).toBe(all[0]);
    expect(all[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(active()).toBe(all[1]);
    fireEvent.keyDown(box(), { key: "ArrowUp" });
    fireEvent.keyDown(box(), { key: "ArrowUp" });
    expect(active()).toBe(all[all.length - 1]);
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(active()).toBe(all[0]);
  });

  it("says so when nothing matches", () => {
    renderShell();
    cmdK();
    type("zzzzqqq");
    expect(screen.getByText(/No matches/)).toBeTruthy();
  });

  it("puts recent picks first when the query is empty", async () => {
    renderShell();
    cmdK();
    await search("brackets");
    fireEvent.click(screen.getByRole("option", { name: /Brackets/ }));
    cmdK();
    await search("rankings");
    fireEvent.keyDown(box(), { key: "Enter" });
    cmdK();
    const [recent] = within(screen.getByRole("listbox")).getAllByRole("group");
    expect(document.getElementById(recent.getAttribute("aria-labelledby")!)!.textContent).toBe("Recent");
    expect(within(recent).getAllByRole("option").map((o) => o.textContent)).toEqual(["Ice Rankings", "Brackets"]);
  });
});

describe("desktop picks", () => {
  it("Cmd+K, bucky, Enter opens that team's profile", async () => {
    vi.mocked(track).mockClear();
    renderShell();
    cmdK();
    await search("bucky");
    expect(active()!.textContent).toContain("Bucky's Badgers");
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(queryBox()).toBeNull();
    await waitFor(() => expect(windowNamed("Team Profile - Bucky's Badgers")).not.toBeNull());
    expect(vi.mocked(track)).toHaveBeenCalledWith("open", `team:${BUCKY}`);
  });

  it("opens a page by a friendly name", async () => {
    renderShell();
    cmdK();
    await search("news drop");
    fireEvent.click(options()[0]);
    await waitFor(() => expect(windowNamed("Smirnoff League - Latest Edition")).not.toBeNull());
  });

  it("opens a game's window", async () => {
    renderShell();
    cmdK();
    await search("week 2 team 4");
    fireEvent.click(screen.getByRole("option", { name: /Week 2: Team 4 vs Team 7/ }));
    await waitFor(() => expect(windowNamed("Week 2: Team 4 vs Team 7")).not.toBeNull());
  });

  it("Upload chug opens the upload with my oldest owed week ticked", async () => {
    renderShell();
    cmdK();
    await search("upload");
    await act(async () => fireEvent.keyDown(box(), { key: "Enter" }));
    const dialog = await screen.findByRole("dialog", { name: "Upload chug" });
    const mine = SCENARIO_LEDGER.ices.filter((i) => i.rosterId === 13 && i.status === "owed").map((i) => i.iceId);
    const ticked = within(dialog)
      .getAllByRole("checkbox")
      .filter((c) => (c as HTMLInputElement).checked)
      .map((c) => (c as HTMLInputElement).value);
    expect(ticked.sort()).toEqual(mine.sort());
  });

  it("Add chug time asks for my latest untimed chug", async () => {
    me(6);
    renderShell();
    cmdK();
    await search("chug time");
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(await screen.findByRole("dialog", { name: "Chug time" })).toBeTruthy();
  });

  it("mutes and unmutes sounds", async () => {
    renderShell();
    cmdK();
    await search("mute");
    fireEvent.click(screen.getByRole("option", { name: "Mute sounds" }));
    expect(isMuted()).toBe(true);
    cmdK();
    await search("sound");
    expect(screen.getByRole("option", { name: "Unmute sounds" })).toBeTruthy();
  });

  it("lists the Control Panel sections only for an admin", async () => {
    renderShell();
    cmdK();
    await screen.findByText(/Every chug|Upload chug/);
    type("control panel");
    expect(screen.queryByRole("option", { name: /Control Panel/ })).toBeNull();
  });

  it("opens a Control Panel section for an admin", async () => {
    me(13, true);
    renderShell();
    cmdK();
    await waitFor(() => {
      type("week rules");
      expect(screen.getByRole("option", { name: "Control Panel: Week Rules" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("option", { name: "Control Panel: Week Rules" }));
    await waitFor(() => expect(windowNamed("Control Panel")).not.toBeNull());
    expect(vi.mocked(track)).toHaveBeenCalledWith("open", "admin:rules");
  });
});

describe("phone", () => {
  const title = () => screen.getByRole("heading", { level: 1 }).textContent;

  it("tap search, type rank, tap Ice Rankings", async () => {
    phone(true);
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("dialog", { name: "Search" })).toBeTruthy();
    await search("rank");
    fireEvent.click(screen.getByRole("option", { name: "Ice Rankings" }));
    expect(queryBox()).toBeNull();
    await waitFor(() => expect(title()).toBe("Ice Rankings"));
  });

  it("pushes a game's screen", async () => {
    phone(true);
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await search("week 2 team 4");
    fireEvent.click(screen.getByRole("option", { name: /Week 2: Team 4 vs Team 7/ }));
    await waitFor(() => expect(title()).toBe("Week 2"));
    expect(window.location.search).toContain("game:2-1");
  });
});
