import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));
vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));
vi.mock("@/lib/api/videos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/videos")>()),
  listVideos: vi.fn(),
}));

import { Desktop } from "@/components/desktop/Desktop";
import { GlacierShell } from "@/components/glacier/GlacierShell";
import { MobileShell } from "@/components/mobile/MobileShell";
import { getLedger } from "@/lib/api/ledger";
import { getMe } from "@/lib/api/users";
import { listVideos, type Video } from "@/lib/api/videos";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";

const SHELLS: Record<string, () => ReactNode> = {
  "XP desktop": () => (
    <DesktopProvider>
      <Desktop />
    </DesktopProvider>
  ),
  "Glacier desktop": () => <GlacierShell />,
  "XP phone": () => <MobileShell theme="xp" />,
  "Glacier phone": () => <MobileShell theme="glacier" />,
};
type Shell = keyof typeof SHELLS;
const PHONES: Shell[] = ["XP phone", "Glacier phone"];

const [W1, W1_OTHER] = SCENARIO_LEDGER.ices.filter((i) => i.week === 1);
const W2 = SCENARIO_LEDGER.ices.find((i) => i.week === 2 && i.reason !== "late")!;
const video = (mediaId: string, iceId: string, week: number, rosterId: number, createdAt: string): Video => ({
  mediaId,
  iceIds: [iceId],
  week,
  rosterIds: [rosterId],
  createdAt,
  bytes: 1,
  url: `https://media.test/${mediaId}.mp4`,
});
const VIDEOS = [
  video("v1", W1.iceId, 1, W1.rosterId, "2026-09-18T12:00:00+00:00"),
  video("v2", W1_OTHER.iceId, 1, W1_OTHER.rosterId, "2026-09-19T12:00:00+00:00"),
  video("v3", W2.iceId, 2, W2.rosterId, "2026-09-25T12:00:00+00:00"),
];

function open(shell: Shell, search: string) {
  // The phone shells get the phone's Filters sheet, the desktops the full bar.
  const phone = PHONES.includes(shell);
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({ matches: phone && query === "(max-width: 639.98px)", media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
  );
  window.history.replaceState(null, "", `/${search}`);
  render(
    <ProfileProvider>
      <NotificationsProvider>{SHELLS[shell]()}</NotificationsProvider>
    </ProfileProvider>,
  );
}

const openParam = () => new URLSearchParams(window.location.search).get("open")?.split(",").at(-1);
const bar = () => screen.findByRole("group", { name: "Filters" });
const count = async () => within(await bar()).getByRole("status").textContent;

// On a phone, pick through the sheet; on a desktop, straight from the bar.
async function pick(shell: Shell, values: Record<string, string>) {
  const filters = await bar();
  if (!PHONES.includes(shell)) {
    for (const [label, value] of Object.entries(values)) fireEvent.change(within(filters).getByLabelText(label), { target: { value } });
    return;
  }
  fireEvent.click(within(filters).getByRole("button", { name: /^Filters/ }));
  const sheet = screen.getByRole("dialog", { name: "Filters" });
  for (const [label, value] of Object.entries(values)) fireEvent.change(within(sheet).getByLabelText(label), { target: { value } });
  fireEvent.click(within(sheet).getByRole("button", { name: "Apply" }));
}

// Each test renders a whole shell, which CI runs several times slower than a laptop.
vi.setConfig({ testTimeout: 20000 });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  stubSleeper();
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  vi.mocked(listVideos).mockResolvedValue(VIDEOS);
  vi.mocked(getMe).mockResolvedValue({
    sub: "s",
    email: "e",
    isAdmin: false,
    profile: { name: "Thirteen", username: "t", rosterId: 13, createdAt: "", updatedAt: "" },
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe.each(Object.keys(SHELLS) as Shell[])("filter links, %s", (shell) => {
  it("follows a chug videos link to its filters and writes a change back in place", async () => {
    open(shell, "?open=videos:week-1.sort-fastest");
    await waitFor(async () => expect(await count()).toBe("2 videos"));
    expect(within(await bar()).getByRole("button", { name: "Remove Week: W1 (2)" })).toBeTruthy();
    const entries = window.history.length;

    await pick(shell, { Week: "2", Sort: "newest" });
    await waitFor(() => expect(openParam()).toBe("videos:week-2"));
    expect(await count()).toBe("1 video");
    expect(window.history.length).toBe(entries);

    fireEvent.click(within(await bar()).getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(openParam()).toBe("videos"));
    expect(await count()).toBe("3 videos");
  });

  it("follows a ledger link to its filters and puts a picked team in the link", async () => {
    open(shell, "?open=ices:status-paid");
    await waitFor(async () => expect(await count()).toBe("5 ices"));
    await pick(shell, { Team: String(W1.rosterId) });
    await waitFor(() => expect(openParam()).toBe(`ices:team-${W1.rosterId}.status-paid`));
    expect(await screen.findByText(/^Week 1 · 1 ice · 1 done/)).toBeTruthy();
  });

  it("follows a news link to its type and clears it from the link", async () => {
    open(shell, "?open=news:type-chugs");
    await waitFor(async () => expect(await count()).toBe("5 items"));
    fireEvent.click(within(await bar()).getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(openParam()).toBe("news"));
  });
});

describe.each(["XP phone", "Glacier phone", "Glacier desktop"] as Shell[])("filters survive history, %s", (shell) => {
  it("comes back from a team to the filtered ledger it left", async () => {
    open(shell, "?open=ices");
    await pick(shell, { Team: "13" });
    await waitFor(() => expect(openParam()).toBe("ices:team-13"));

    const week2 = (await screen.findByText(/^Week 2 ·/)).closest("details")!;
    fireEvent.click(within(week2).getByRole("button", { name: /Team 13/ }));
    await waitFor(() => expect(openParam()).toMatch(/^team:13/));

    act(() => window.history.back());
    await waitFor(() => expect(openParam()).toBe("ices:team-13"));
    expect(await count()).toBe("4 ices");
    act(() => window.history.forward());
    await waitFor(() => expect(openParam()).toMatch(/^team:13/));
  });
});

describe("filters survive window history, XP desktop", () => {
  it("returns a window to the filtered ledger it drilled from", async () => {
    open("XP desktop", "?open=ices:team-13");
    const week2 = (await screen.findByText(/^Week 2 ·/)).closest("details")!;
    fireEvent.click(within(week2).getByRole("button", { name: /Team 13/ }));
    await waitFor(() => expect(openParam()).toMatch(/^team:13/));

    fireEvent.click(screen.getAllByRole("button", { name: "Back" }).at(-1)!);
    await waitFor(() => expect(openParam()).toBe("ices:team-13"));
    expect(await count()).toBe("4 ices");
  });
});
