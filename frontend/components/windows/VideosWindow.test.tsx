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
import { getLedger, type Ledger } from "@/lib/api/ledger";
import { ApiError, getMe, type Me } from "@/lib/api/users";
import { confirmVideo, listVideos, presignVideo, type Video } from "@/lib/api/videos";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { play } from "@/lib/sound/sound";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { FakeXhr } from "@/lib/test/xhr-mock";
import { IcesWindow } from "./IcesWindow";
import { VideosWindow } from "./VideosWindow";

const W1_FIRST = SCENARIO_LEDGER.ices.find((i) => i.week === 1)!;
const W1_VIDEO: Video = {
  mediaId: "W01#v1",
  iceId: W1_FIRST.iceId,
  week: 1,
  rosterId: W1_FIRST.rosterId,
  uploaderName: "Commish",
  createdAt: "2026-09-20T12:00:00+00:00",
  bytes: 5_000_000,
  url: "https://media.test/v1.mp4",
};
const withVideo = (ledger: Ledger, iceId: string, videoId: string): Ledger => ({
  ...ledger,
  ices: ledger.ices.map((i) => (i.iceId === iceId ? { ...i, status: "completed", videoId } : i)),
});
const LEDGER = withVideo(SCENARIO_LEDGER, W1_FIRST.iceId, W1_VIDEO.mediaId);

function me(isAdmin: boolean, rosterId = 13): Me {
  return { sub: "s", email: "e", profile: { name: "N", username: "u", rosterId, createdAt: "", updatedAt: "" }, isAdmin };
}

function renderWindow(isAdmin = false) {
  vi.mocked(getMe).mockResolvedValue(me(isAdmin));
  return render(
    <ProfileProvider>
      <VideosWindow />
    </ProfileProvider>,
  );
}

const section = (name: string) => screen.getByRole("region", { name });
const mp4 = (size = 4) => new File(["x".repeat(size)], "chug.mp4", { type: "video/mp4" });

async function openUpload() {
  const button = await screen.findByRole("button", { name: "Upload video..." });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
  return screen.getByRole("dialog", { name: "Upload chug" });
}

async function submit(dialog: HTMLElement, file = mp4()) {
  fireEvent.change(within(dialog).getByLabelText("Video file"), { target: { files: [file] } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
}

beforeEach(() => {
  stubSleeper();
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  // Otherwise the previous test's request satisfies every wait on the URL.
  FakeXhr.last = new FakeXhr();
  vi.mocked(getLedger).mockResolvedValue(LEDGER);
  vi.mocked(listVideos).mockResolvedValue([W1_VIDEO]);
  vi.mocked(presignVideo).mockResolvedValue({ mediaId: "W02#new", url: "https://bucket.test", fields: { key: "k", policy: "p" } });
  vi.mocked(confirmVideo).mockResolvedValue(undefined);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("Chug Videos window", () => {
  it("splits the ledger into owes, completed with a playable video, and completed without", async () => {
    renderWindow();
    const completed = await screen.findByRole("region", { name: "Completed" });
    const video = completed.querySelector("video")!;
    expect(video.getAttribute("src")).toBe(`${W1_VIDEO.url}#t=0.1`);
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(within(completed).getByText(/posted by commish/i)).toBeTruthy();
    expect(within(completed).getByRole("button", { name: "W1" })).toBeTruthy();
    expect(within(completed).getByRole("button", { name: new RegExp(`Team ${W1_FIRST.rosterId}`) })).toBeTruthy();

    expect(within(section("Owes")).getAllByRole("listitem")).toHaveLength(6);
    expect(within(section("Completed without video")).getAllByRole("listitem")).toHaveLength(4);
    expect(within(section("Owes")).getAllByRole("button", { name: /team 13/i }).length).toBeGreaterThan(0);
  });

  it("filters by week and team", async () => {
    renderWindow();
    await screen.findByRole("region", { name: "Completed" });
    fireEvent.change(screen.getByLabelText("Week"), { target: { value: "2" } });
    expect(within(section("Owes")).getAllByRole("listitem")).toHaveLength(6);
    expect(within(section("Completed without video")).queryAllByRole("listitem")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Team"), { target: { value: "12" } });
    expect(within(section("Owes")).getAllByRole("listitem")).toHaveLength(2);
    expect(within(section("Owes")).queryByText("Team 13")).toBeNull();
  });

  it("refetches the list when a presigned video URL has expired", async () => {
    renderWindow();
    const video = (await screen.findByRole("region", { name: "Completed" })).querySelector("video")!;
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * 60 * 60 * 1000);
    fireEvent.error(video);
    await waitFor(() => expect(listVideos).toHaveBeenCalledTimes(2));
  });

  it("offers only my team's owed ices in the picker", async () => {
    renderWindow();
    const dialog = await openUpload();
    const options = within(within(dialog).getByLabelText("Ice")).getAllByRole("option");
    expect(options).toHaveLength(4);
    for (const o of options) expect(o.textContent).toMatch(/^Week 2 · Team 13 · /);
  });

  it("offers every ice to an admin", async () => {
    renderWindow(true);
    const dialog = await openUpload();
    expect(within(within(dialog).getByLabelText("Ice")).getAllByRole("option")).toHaveLength(LEDGER.ices.length);
  });

  it("rejects a non-video file before asking the server", async () => {
    renderWindow();
    const dialog = await openUpload();
    await submit(dialog, new File(["x"], "notes.txt", { type: "text/plain" }));
    expect(within(dialog).getByRole("alert").textContent).toMatch(/choose a video file/i);
    expect(presignVideo).not.toHaveBeenCalled();
  });

  it("puts the presigned fields before the file and shows progress", async () => {
    renderWindow();
    const dialog = await openUpload();
    const file = mp4();
    await submit(dialog, file);
    await waitFor(() => expect(FakeXhr.last?.url).toBe("https://bucket.test"));
    expect(presignVideo).toHaveBeenCalledWith({ iceId: expect.stringMatching(/^W02#R13#/), contentType: "video/mp4", bytes: file.size });
    expect([...FakeXhr.last.body.keys()]).toEqual(["key", "policy", "file"]);

    act(() => FakeXhr.last.progress(1, 4));
    expect(within(dialog).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    act(() => FakeXhr.last.progress(3, 4));
    expect(within(dialog).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("75");
  });

  it.each([
    [403, "That ice belongs to another roster", /only upload chugs for your own team's ices/i],
    [400, "That ice was voided", /server refused this upload \(that ice was voided\)/i],
  ])("explains a %i from presign", async (status, message, copy) => {
    vi.mocked(presignVideo).mockRejectedValue(new ApiError(status, message));
    renderWindow();
    const dialog = await openUpload();
    await submit(dialog);
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(copy);
    expect(play).toHaveBeenCalledWith("error");
  });

  it("explains a 409 from confirm and retries the whole upload", async () => {
    vi.mocked(confirmVideo).mockRejectedValueOnce(new ApiError(409, "The upload has not landed in S3"));
    renderWindow();
    const dialog = await openUpload();
    await submit(dialog);
    await waitFor(() => expect(FakeXhr.last?.url).toBe("https://bucket.test"));
    act(() => FakeXhr.last.finish(204));
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/never finished landing/i);

    const first = FakeXhr.last;
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(FakeXhr.last).not.toBe(first));
    act(() => FakeXhr.last.finish(204));
    expect(await within(dialog).findByText("ICE.EXE completed successfully")).toBeTruthy();
    expect(presignVideo).toHaveBeenCalledTimes(2);
  });
});

describe("Ice Ledger upload action", () => {
  it("sits next to my team's owed ices only and preselects the ice", async () => {
    vi.mocked(getMe).mockResolvedValue(me(false));
    render(
      <ProfileProvider>
        <IcesWindow />
      </ProfileProvider>,
    );
    const week2 = await screen.findByRole("region", { name: "Week 2" });
    const mine = within(week2).getByRole("list", { name: "Team 13 ices" });
    await waitFor(() => expect(within(mine).getAllByRole("button", { name: "Upload chug" })).toHaveLength(4));
    expect(within(within(week2).getByRole("list", { name: "Team 12 ices" })).queryByRole("button", { name: "Upload chug" })).toBeNull();

    const row = within(mine).getAllByRole("listitem")[0];
    fireEvent.click(within(row).getByRole("button", { name: "Upload chug" }));
    const picker = within(screen.getByRole("dialog", { name: "Upload chug" })).getByLabelText("Ice") as HTMLSelectElement;
    expect(picker.selectedOptions[0].textContent).toMatch(/lowest score/i);
  });
});

describe("scenario: uploading a chug", () => {
  it("a signed-in user uploads for an owed ice and it moves to Completed, playable", async () => {
    vi.mocked(getMe).mockResolvedValue(me(false));
    const target = LEDGER.ices.find((i) => i.iceId === "W02#R13#LOWEST")!;
    const uploaded: Video = { ...W1_VIDEO, mediaId: "W02#new", iceId: target.iceId, week: 2, rosterId: 13, url: "https://media.test/new.mp4" };
    render(
      <ProfileProvider>
        <DesktopProvider>
          <Desktop />
        </DesktopProvider>
      </ProfileProvider>,
    );
    fireEvent.doubleClick(screen.getByRole("button", { name: "Chug Videos" }));
    const win = document.querySelector<HTMLElement>('section[aria-label="Chug Videos"]')!;
    const owes = await within(win).findByRole("region", { name: "Owes" });
    const upload = await within(owes).findAllByRole("button", { name: "Upload chug" });
    fireEvent.click(upload[0]);

    const dialog = screen.getByRole("dialog", { name: "Upload chug" });
    const picker = within(dialog).getByLabelText("Ice") as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: target.iceId } });
    await submit(dialog);
    await waitFor(() => expect(FakeXhr.last?.url).toBe("https://bucket.test"));
    act(() => FakeXhr.last.progress(2, 2));

    vi.mocked(getLedger).mockResolvedValue(withVideo(LEDGER, target.iceId, "W02#new"));
    vi.mocked(listVideos).mockResolvedValue([uploaded, W1_VIDEO]);
    act(() => FakeXhr.last.finish(204));

    expect(await within(dialog).findByText("ICE.EXE completed successfully")).toBeTruthy();
    expect(confirmVideo).toHaveBeenCalledWith("W02#new");
    expect(play).toHaveBeenCalledWith("chord");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    const completed = within(win).getByRole("region", { name: "Completed" });
    await waitFor(() => expect(completed.querySelectorAll("video")).toHaveLength(2));
    expect(completed.querySelector("video")!.getAttribute("src")).toBe(`${uploaded.url}#t=0.1`);
    expect(within(within(win).getByRole("region", { name: "Owes" }).querySelector("ul")!).getAllByRole("listitem")).toHaveLength(5);
  });
});
