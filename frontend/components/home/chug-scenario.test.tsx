import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));
vi.mock("@/lib/api/videos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/videos")>()),
  listVideos: vi.fn(),
  presignVideo: vi.fn(),
  confirmVideo: vi.fn(),
}));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));
vi.mock("@/lib/sound/sound", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound/sound")>()),
  play: vi.fn(),
}));

import { Desktop } from "@/components/desktop/Desktop";
import { Taskbar } from "@/components/xp/Taskbar";
import { getLedger, type Ledger } from "@/lib/api/ledger";
import { getMe, type Me } from "@/lib/api/users";
import { confirmVideo, listVideos, presignVideo, type Video } from "@/lib/api/videos";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { FakeXhr } from "@/lib/test/xhr-mock";

// Friday of W2, two days before the deadline, so no late rows exist yet.
const LEDGER: Ledger = { ...SCENARIO_LEDGER, ices: SCENARIO_LEDGER.ices.filter((i) => i.reason !== "late") };
const MINE = LEDGER.ices.find((i) => i.week === 2 && i.rosterId === 12)!;
const UPLOADED: Video = { mediaId: "W02#new", iceId: MINE.iceId, week: 2, rosterId: 12, createdAt: "2026-09-25T22:05:00+00:00", bytes: 4, url: "https://media.test/new.mp4" };
const me: Me = { sub: "s", email: "e", profile: { name: "N", username: "u", rosterId: 12, createdAt: "", updatedAt: "" }, isAdmin: false };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-25T22:00:00Z"));
  stubSleeper();
  Element.prototype.setPointerCapture = vi.fn();
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  FakeXhr.last = new FakeXhr();
  vi.mocked(getMe).mockResolvedValue(me);
  vi.mocked(getLedger).mockResolvedValue(LEDGER);
  vi.mocked(listVideos).mockResolvedValue([]);
  vi.mocked(presignVideo).mockResolvedValue({ mediaId: UPLOADED.mediaId, url: "https://bucket.test", fields: { key: "k" } });
  vi.mocked(confirmVideo).mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("scenario: Friday of W2, owing one ice", () => {
  it("counts down on the board and in the tray, then flips to done with the video", async () => {
    render(
      <ProfileProvider>
        <DesktopProvider>
          <Desktop />
          <Taskbar />
        </DesktopProvider>
      </ProfileProvider>,
    );

    const tray = await screen.findByRole("button", { name: "You owe 1 ice · due in 1d 19h" });
    expect(tray.className).toContain("due-due");

    const row = await screen.findByRole("list", { name: "Team 12 chugs" });
    const owed = row.querySelector(".chug-owed")!;
    expect(owed.querySelector(".chug-countdown")?.textContent).toBe("due in 1d 19h");
    const upload = await within(row).findByRole("button", { name: "Upload chug" });
    fireEvent.click(upload);

    const dialog = screen.getByRole("dialog", { name: "Upload chug" });
    expect((within(dialog).getByLabelText("Ice") as HTMLSelectElement).value).toBe(MINE.iceId);
    fireEvent.change(within(dialog).getByLabelText("Video file"), { target: { files: [new File(["chug"], "chug.mp4", { type: "video/mp4" })] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(FakeXhr.last?.url).toBe("https://bucket.test"));

    vi.mocked(getLedger).mockResolvedValue({
      ...LEDGER,
      ices: LEDGER.ices.map((i) => (i.iceId === MINE.iceId ? { ...i, status: "completed", videoId: UPLOADED.mediaId } : i)),
    });
    vi.mocked(listVideos).mockResolvedValue([UPLOADED]);
    act(() => FakeXhr.last.finish(204));
    expect(await within(dialog).findByText("ICE.EXE completed successfully")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    const play = await within(screen.getByRole("list", { name: "Team 12 chugs" })).findByRole("button", { name: "Play Team 12 · Week 2 chug" });
    expect(play.querySelector("video")!.getAttribute("src")).toBe(`${UPLOADED.url}#t=0.1`);
    expect(screen.getByRole("list", { name: "Team 12 chugs" }).querySelector(".chug-owed")).toBeNull();
    await waitFor(() => expect(screen.queryByRole("button", { name: /^You owe/ })).toBeNull());
  });
});
