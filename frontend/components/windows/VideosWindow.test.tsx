import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("@/lib/api/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/social")>()),
  getSocial: vi.fn(),
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
import { getSocial, type VideoSocial } from "@/lib/api/social";
import { play } from "@/lib/sound/sound";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { FakeXhr } from "@/lib/test/xhr-mock";
import { TeamView } from "@/components/views/team-view";
import { IcesWindow } from "./IcesWindow";
import { VideosWindow } from "./VideosWindow";

const W1_FIRST = SCENARIO_LEDGER.ices.find((i) => i.week === 1)!;
const W1_VIDEO: Video = {
  mediaId: "W01#v1",
  iceIds: [W1_FIRST.iceId],
  week: 1,
  rosterIds: [W1_FIRST.rosterId],
  uploaderName: "Commish",
  createdAt: "2026-09-20T12:00:00+00:00",
  bytes: 5_000_000,
  url: "https://media.test/v1.mp4",
};
const withVideo = (ledger: Ledger, iceIds: string | string[], videoId: string): Ledger => ({
  ...ledger,
  ices: ledger.ices.map((i) => ([iceIds].flat().includes(i.iceId) ? { ...i, status: "completed", videoId } : i)),
});
const W2_OWED = (rosterId: number) => SCENARIO_LEDGER.ices.filter((i) => i.week === 2 && i.rosterId === rosterId && i.reason !== "late");
const LEDGER = withVideo(SCENARIO_LEDGER, W1_FIRST.iceId, W1_VIDEO.mediaId);

const reaction = (count: number) => ({ count, mine: false, by: [] });
const socialWith = (count: number): VideoSocial => ({
  reactions: { glacier: reaction(count), stopwatch: reaction(0), bottle: reaction(0), siren: reaction(0), crown: reaction(0) },
  comments: [],
});

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

const myBoxes = (dialog: HTMLElement) => within(within(dialog).getByRole("group", { name: "Your ices" })).getAllByRole("checkbox") as HTMLInputElement[];

async function submit(dialog: HTMLElement, file = mp4()) {
  if (!within(dialog).queryAllByRole("checkbox").some((c) => (c as HTMLInputElement).checked)) fireEvent.click(myBoxes(dialog)[0]);
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
  vi.mocked(getSocial).mockResolvedValue(socialWith(0));
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

  it("narrows owes, videos and unfilmed chugs by ice type", async () => {
    renderWindow();
    await screen.findByRole("region", { name: "Completed" });
    fireEvent.change(screen.getByLabelText("Ice type"), { target: { value: "late" } });
    const owes = within(section("Owes")).getAllByRole("listitem");
    expect(owes).toHaveLength(3);
    expect(owes.every((li) => li.textContent?.includes("Late ice"))).toBe(true);
    expect(within(section("Completed")).queryAllByRole("listitem", { name: /chug video/i })).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Ice type"), { target: { value: W1_FIRST.reason } });
    expect(within(section("Completed")).getAllByRole("listitem", { name: /chug video/i })).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("1 video");
  });

  it("shows an empty state when nothing matches and clears back", async () => {
    renderWindow();
    await screen.findByRole("region", { name: "Completed" });
    fireEvent.change(screen.getByLabelText("Week"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Ice type"), { target: { value: "late" } });
    expect(screen.getByText("No chugs match these filters.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Owes" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("0 videos");

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(within(section("Completed")).getAllByRole("listitem", { name: /chug video/i })).toHaveLength(1);
    expect(screen.queryByText("No chugs match these filters.")).toBeNull();
  });

  it("sorts videos by fastest time and, fetching counts only then, by reactions", async () => {
    const other = LEDGER.ices.find((i) => i.week === 1 && i.rosterId !== W1_FIRST.rosterId)!;
    const later: Video = { ...W1_VIDEO, mediaId: "W01#v2", iceIds: [other.iceId], rosterIds: [other.rosterId], createdAt: "2026-09-21T12:00:00+00:00" };
    const timed = withVideo(LEDGER, other.iceId, later.mediaId);
    vi.mocked(getLedger).mockResolvedValue({ ...timed, ices: timed.ices.map((i) => (i.iceId === W1_FIRST.iceId ? { ...i, chugSeconds: 4.2 } : i.iceId === other.iceId ? { ...i, chugSeconds: 8 } : i)) });
    vi.mocked(listVideos).mockResolvedValue([W1_VIDEO, later]);
    renderWindow();
    const order = () => within(section("Completed")).getAllByRole("listitem", { name: /chug video/i }).map((c) => c.querySelector("video")!.getAttribute("src"));
    await waitFor(() => expect(order()).toEqual([`${later.url}#t=0.1`, `${W1_VIDEO.url}#t=0.1`]));

    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "fastest" } });
    expect(order()).toEqual([`${W1_VIDEO.url}#t=0.1`, `${later.url}#t=0.1`]);

    vi.mocked(getSocial).mockClear();
    vi.mocked(getSocial).mockImplementation(async (id) => socialWith(id === W1_VIDEO.mediaId ? 5 : 2));
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "reactions" } });
    await waitFor(() => expect(getSocial).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(order()).toEqual([`${W1_VIDEO.url}#t=0.1`, `${later.url}#t=0.1`]));
  });

  it("refetches the list when a presigned video URL has expired", async () => {
    renderWindow();
    const video = (await screen.findByRole("region", { name: "Completed" })).querySelector("video")!;
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * 60 * 60 * 1000);
    fireEvent.error(video);
    await waitFor(() => expect(listVideos).toHaveBeenCalledTimes(2));
  });

  it("offers my team's owed ices as checkboxes, none ticked", async () => {
    renderWindow();
    const dialog = await openUpload();
    const boxes = myBoxes(dialog);
    expect(boxes).toHaveLength(4);
    for (const b of boxes) expect(b.closest("label")!.textContent).toMatch(/^Week 2 · Team 13 · /);
    expect(boxes.some((b) => b.checked)).toBe(false);
  });

  it("offers every ice to an admin, one week at a time", async () => {
    renderWindow(true);
    const dialog = await openUpload();
    const boxes = myBoxes(dialog);
    expect(boxes).toHaveLength(LEDGER.ices.length);
    fireEvent.click(boxes.find((b) => b.value === W2_OWED(13)[0].iceId)!);
    const w1 = boxes.filter((b) => b.value.startsWith("W01#"));
    expect(w1.length).toBeGreaterThan(0);
    expect(w1.every((b) => b.disabled)).toBe(true);
  });

  it("presigns every ticked ice in one upload", async () => {
    renderWindow();
    const dialog = await openUpload();
    const [a, b] = W2_OWED(13);
    for (const ice of [a, b]) fireEvent.click(myBoxes(dialog).find((c) => c.value === ice.iceId)!);
    const file = mp4();
    await submit(dialog, file);
    expect(presignVideo).toHaveBeenCalledWith({ iceIds: [a.iceId, b.iceId], contentType: "video/mp4", bytes: file.size });
  });

  it("refuses to upload with no ice ticked", async () => {
    renderWindow();
    const dialog = await openUpload();
    fireEvent.change(within(dialog).getByLabelText("Video file"), { target: { files: [mp4()] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
    expect(within(dialog).getByRole("alert").textContent).toMatch(/tick at least one ice/i);
    expect(presignVideo).not.toHaveBeenCalled();
  });

  it("adds another team's owed ices for the same week and names both teams when done", async () => {
    renderWindow();
    const dialog = await openUpload();
    fireEvent.click(myBoxes(dialog)[0]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Chugged with someone?" }));
    const team = within(dialog).getByLabelText("Team") as HTMLSelectElement;
    expect([...team.options].map((o) => o.textContent)).toEqual(["Pick a team", "Team 12"]);
    fireEvent.change(team, { target: { value: "12" } });
    const theirs = within(within(dialog).getByRole("group", { name: "Team 12 ices" })).getAllByRole("checkbox") as HTMLInputElement[];
    expect(theirs).toHaveLength(2);
    fireEvent.click(theirs[0]);
    expect(within(dialog).getByText(/covers team 13 and team 12/i)).toBeTruthy();

    const expected = [myBoxes(dialog)[0].value, theirs[0].value];
    await submit(dialog);
    expect(presignVideo).toHaveBeenCalledWith(expect.objectContaining({ iceIds: expected }));
    await waitFor(() => expect(FakeXhr.last?.url).toBe("https://bucket.test"));
    act(() => FakeXhr.last.finish(204));
    expect(await within(dialog).findByText("ICE.EXE completed successfully")).toBeTruthy();
    expect(within(dialog).getByText("Chug logged for Team 13 and Team 12.")).toBeTruthy();
  });

  it("shows one card for a video covering two teams, under either team's filter", async () => {
    const others = LEDGER.ices.filter((i) => i.week === 1 && i.rosterId !== W1_FIRST.rosterId);
    const a = others[0];
    const b = others.find((i) => i.rosterId !== a.rosterId)!;
    const shared: Video = { ...W1_VIDEO, mediaId: "W01#both", iceIds: [a.iceId, b.iceId], rosterIds: [a.rosterId, b.rosterId], url: "https://media.test/both.mp4" };
    vi.mocked(getLedger).mockResolvedValue(withVideo(LEDGER, [a.iceId, b.iceId], shared.mediaId));
    vi.mocked(listVideos).mockResolvedValue([shared, W1_VIDEO]);
    renderWindow();
    const completed = await screen.findByRole("region", { name: "Completed" });
    await waitFor(() => expect(within(completed).getAllByRole("listitem", { name: /chug video/i })).toHaveLength(2));
    const card = within(completed).getByRole("listitem", { name: `Team ${a.rosterId} and Team ${b.rosterId} chug video` });
    expect(within(card).getByRole("button", { name: new RegExp(`Team ${a.rosterId}`) })).toBeTruthy();
    expect(within(card).getByRole("button", { name: new RegExp(`Team ${b.rosterId}`) })).toBeTruthy();

    for (const rosterId of [a.rosterId, b.rosterId]) {
      fireEvent.change(screen.getByLabelText("Team"), { target: { value: String(rosterId) } });
      const cards = within(section("Completed")).getAllByRole("listitem", { name: /chug video/i });
      expect(cards.map((c) => c.getAttribute("aria-label"))).toEqual([`Team ${a.rosterId} and Team ${b.rosterId} chug video`]);
    }
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
    expect(presignVideo).toHaveBeenCalledWith({ iceIds: [expect.stringMatching(/^W02#R13#/)], contentType: "video/mp4", bytes: file.size });
    expect([...FakeXhr.last.body.keys()]).toEqual(["key", "policy", "file"]);

    act(() => FakeXhr.last.progress(1, 4));
    expect(within(dialog).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    act(() => FakeXhr.last.progress(3, 4));
    expect(within(dialog).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("75");
  });

  it.each([
    [403, "None of those ices belong to your roster", /tick at least one of your own team's ices/i],
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
  it("sits next to my team's owed ices only and preselects just that ice", async () => {
    vi.mocked(getMe).mockResolvedValue(me(false));
    render(
      <ProfileProvider>
        <IcesWindow />
      </ProfileProvider>,
    );
    const week2 = await screen.findByRole("region", { name: /^Week 2 ·/ });
    const mine = within(week2).getByRole("list", { name: "Team 13 ices" });
    await waitFor(() => expect(within(mine).getAllByRole("button", { name: "Upload chug" })).toHaveLength(4));
    expect(within(within(week2).getByRole("list", { name: "Team 12 ices" })).queryByRole("button", { name: "Upload chug" })).toBeNull();

    const row = within(mine).getAllByRole("listitem")[0];
    fireEvent.click(within(row).getByRole("button", { name: "Upload chug" }));
    const ticked = myBoxes(screen.getByRole("dialog", { name: "Upload chug" })).filter((c) => c.checked);
    expect(ticked).toHaveLength(1);
    expect(ticked[0].closest("label")!.textContent).toMatch(/lowest score/i);
  });
});

describe("scenario: uploading a chug", () => {
  it("a signed-in user uploads for an owed ice and it moves to Completed, playable", async () => {
    vi.mocked(getMe).mockResolvedValue(me(false));
    const target = LEDGER.ices.find((i) => i.iceId === "W02#R13#LOWEST")!;
    const uploaded: Video = { ...W1_VIDEO, mediaId: "W02#new", iceIds: [target.iceId], week: 2, rosterIds: [13], url: "https://media.test/new.mp4" };
    render(
      <ProfileProvider>
        <DesktopProvider>
          <Desktop />
        </DesktopProvider>
      </ProfileProvider>,
    );
    // In the app AuthGate loads the profile first; here the desktop would restore
    // its layout when it lands and reopen the folder's view as a new window.
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.doubleClick(within(screen.getByRole("list", { name: "Desktop" })).getByRole("button", { name: "Ices" }));
    fireEvent.doubleClick(within(screen.getByRole("list", { name: "Ices" })).getByRole("button", { name: "Chug Videos" }));
    const win = document.querySelector<HTMLElement>('section[aria-label="Chug Videos"]')!;
    const owes = await within(win).findByRole("region", { name: "Owes" });
    const upload = await within(owes).findAllByRole("button", { name: "Upload chug" });
    fireEvent.click(upload[0]);

    const dialog = screen.getByRole("dialog", { name: "Upload chug" });
    for (const box of myBoxes(dialog)) if (box.checked !== (box.value === target.iceId)) fireEvent.click(box);
    await submit(dialog);
    expect(presignVideo).toHaveBeenCalledWith(expect.objectContaining({ iceIds: [target.iceId] }));
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

describe("scenario: two teams chug together", () => {
  it("one upload covering both teams' W2 ices completes both, and both profiles show the same video", async () => {
    const [ours] = W2_OWED(13);
    const [theirs] = W2_OWED(12);
    const shared: Video = { ...W1_VIDEO, mediaId: "W02#new", iceIds: [ours.iceId, theirs.iceId], week: 2, rosterIds: [13, 12], url: "https://media.test/both.mp4" };
    renderWindow();
    const dialog = await openUpload();
    fireEvent.click(myBoxes(dialog).find((c) => c.value === ours.iceId)!);
    fireEvent.click(within(dialog).getByRole("button", { name: "Chugged with someone?" }));
    fireEvent.change(within(dialog).getByLabelText("Team"), { target: { value: "12" } });
    fireEvent.click(within(within(dialog).getByRole("group", { name: "Team 12 ices" })).getAllByRole("checkbox").find((c) => (c as HTMLInputElement).value === theirs.iceId)!);
    await submit(dialog);
    expect(presignVideo).toHaveBeenCalledWith(expect.objectContaining({ iceIds: [ours.iceId, theirs.iceId] }));

    vi.mocked(getLedger).mockResolvedValue(withVideo(LEDGER, [ours.iceId, theirs.iceId], shared.mediaId));
    vi.mocked(listVideos).mockResolvedValue([shared, W1_VIDEO]);
    await waitFor(() => expect(FakeXhr.last?.url).toBe("https://bucket.test"));
    act(() => FakeXhr.last.finish(204));
    expect(await within(dialog).findByText("Chug logged for Team 13 and Team 12.")).toBeTruthy();
    expect(confirmVideo).toHaveBeenCalledWith("W02#new");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    cleanup();

    for (const rosterId of [13, 12]) {
      const { unmount } = render(
        <ProfileProvider>
          <TeamView rosterId={rosterId} />
        </ProfileProvider>,
      );
      await screen.findByRole("table", { name: "Weekly results" });
      fireEvent.click(screen.getByRole("tab", { name: "Ices" }));
      const table = await screen.findByRole("table", { name: "Season ices" });
      const [play] = await within(table).findAllByRole("button", { name: /^Play Week 2/ });
      fireEvent.click(play);
      expect(screen.getByRole("dialog").querySelector("video")!.getAttribute("src")).toBe(`${shared.url}#t=0.1`);
      unmount();
    }
  });
});
