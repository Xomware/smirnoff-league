import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/social")>()),
  getSocial: vi.fn(),
  toggleReaction: vi.fn(),
  postComment: vi.fn(),
  deleteComment: vi.fn(),
}));
const profile = vi.hoisted(() => ({ isAdmin: false }));
vi.mock("@/lib/profile/use-profile", () => ({
  useProfile: () => ({
    myRosterId: 4,
    me: { sub: "s", email: "e", isAdmin: profile.isAdmin, profile: { name: "Me", username: "me", rosterId: 4, createdAt: "", updatedAt: "" } },
  }),
}));
vi.mock("@/lib/league/use-league", () => ({
  useLeague: () => ({ teamFor: (r: number) => ({ name: `Team ${r}`, avatarUrl: null, record: { wins: 0, losses: 0, ties: 0 } }) }),
}));

import { deleteComment, getSocial, postComment, REACTIONS, toggleReaction, type VideoComment, type VideoSocial as Social } from "@/lib/api/social";
import { VideoSocial } from "./VideoSocial";

const comment = (id: string, over: Partial<VideoComment> = {}): VideoComment => ({
  id,
  author: { rosterId: 7, displayName: "Seven" },
  text: `comment ${id}`,
  createdAt: "2026-09-29T12:00:00+00:00",
  mine: false,
  ...over,
});

function social(over: Partial<Social> = {}): Social {
  const reactions = Object.fromEntries(REACTIONS.map((t) => [t, { count: 0, mine: false, by: [] as string[] }])) as Social["reactions"];
  reactions.crown = { count: 2, mine: true, by: ["Me", "Seven"] };
  return { reactions, comments: [comment("c1"), comment("c2", { author: { rosterId: 4, displayName: "Me" }, mine: true })], ...over };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const reaction = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}, \\d+$`) });

async function mount(data = social()) {
  vi.mocked(getSocial).mockResolvedValue(data);
  render(<VideoSocial videoId="W02#v1" />);
  await screen.findByRole("group", { name: "Reactions" });
}

beforeEach(() => {
  vi.resetAllMocks();
  profile.isAdmin = false;
});

describe("VideoSocial", () => {
  it("shows every reaction with its count, mine pressed, and who reacted", async () => {
    await mount();
    expect(getSocial).toHaveBeenCalledWith("W02#v1");
    const crown = reaction("Chug king");
    expect(crown.getAttribute("aria-pressed")).toBe("true");
    expect(crown.textContent).toContain("2");
    expect(crown.getAttribute("title")).toBe("Chug king: Me, Seven");
    expect(reaction("Ice cold").getAttribute("aria-pressed")).toBe("false");
  });

  it("toggles a reaction at once and keeps the server's copy", async () => {
    await mount();
    const call = deferred<Social>();
    vi.mocked(toggleReaction).mockReturnValue(call.promise);

    fireEvent.click(reaction("Ice cold"));
    expect(toggleReaction).toHaveBeenCalledWith("W02#v1", "glacier");
    expect(reaction("Ice cold").getAttribute("aria-pressed")).toBe("true");
    expect(reaction("Ice cold").textContent).toContain("1");

    const server = social();
    server.reactions.glacier = { count: 3, mine: true, by: ["Me", "A", "B"] };
    await act(async () => call.resolve(server));
    expect(reaction("Ice cold").textContent).toContain("3");
  });

  it("rolls a failed reaction back and says why", async () => {
    await mount();
    vi.mocked(toggleReaction).mockRejectedValue(new Error("Internal error"));
    fireEvent.click(reaction("Chug king"));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not react (Internal error).");
    expect(reaction("Chug king").getAttribute("aria-pressed")).toBe("true");
    expect(reaction("Chug king").textContent).toContain("2");
  });

  it("long-press lists who reacted without toggling", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await mount();
      fireEvent.pointerDown(reaction("Chug king"));
      act(() => vi.advanceTimersByTime(500));
      fireEvent.pointerUp(reaction("Chug king"));
      fireEvent.click(reaction("Chug king"));
      expect(screen.getByRole("status").textContent).toContain("Chug king: Me, Seven");
      expect(toggleReaction).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("posts a comment optimistically with a 280 counter", async () => {
    await mount();
    const call = deferred<Social>();
    vi.mocked(postComment).mockReturnValue(call.promise);
    const box = screen.getByRole("textbox", { name: "Add a comment" });
    expect(box?.getAttribute("maxLength")).toBe("280");

    fireEvent.change(box, { target: { value: "  cold one  " } });
    expect(screen.getByText("12/280")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    expect(postComment).toHaveBeenCalledWith("W02#v1", "cold one");
    expect((box as HTMLTextAreaElement).value).toBe("");
    const pending = screen.getByText("cold one").closest("li");
    expect(pending?.getAttribute("aria-busy")).toBe("true");

    await act(async () => call.resolve(social({ comments: [comment("c3", { text: "cold one", mine: true })] })));
    expect(screen.getByText("cold one").closest("li")?.getAttribute("aria-busy")).toBe("false");
  });

  it("rolls a failed comment back and restores the draft", async () => {
    await mount();
    vi.mocked(postComment).mockRejectedValue(new Error("Slow down"));
    const box = screen.getByRole("textbox", { name: "Add a comment" });
    fireEvent.change(box, { target: { value: "too fast" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Could not post (Slow down).");
    expect(screen.queryByText("too fast", { selector: ".social-text" })).toBeNull();
    expect((box as HTMLTextAreaElement).value).toBe("too fast");
  });

  it("disables Post for a blank comment", async () => {
    await mount();
    fireEvent.change(screen.getByRole("textbox", { name: "Add a comment" }), { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("deletes only my own comments, rolling back on failure", async () => {
    await mount();
    expect(screen.queryByRole("button", { name: "Delete comment: comment c1" })).toBeNull();

    vi.mocked(deleteComment).mockRejectedValueOnce(new Error("Internal error"));
    fireEvent.click(screen.getByRole("button", { name: "Delete comment: comment c2" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not delete (Internal error).");
    expect(screen.getByText("comment c2")).toBeTruthy();

    vi.mocked(deleteComment).mockResolvedValue(social({ comments: [comment("c1")] }));
    fireEvent.click(screen.getByRole("button", { name: "Delete comment: comment c2" }));
    expect(deleteComment).toHaveBeenLastCalledWith("W02#v1", "c2");
    expect(screen.queryByText("comment c2")).toBeNull();
  });

  it("lets an admin delete anyone's comment", async () => {
    profile.isAdmin = true;
    await mount();
    expect(screen.getByRole("button", { name: "Delete comment: comment c1" })).toBeTruthy();
  });

  it("shows the latest three until asked for all", async () => {
    await mount(social({ comments: ["a", "b", "c", "d", "e"].map((id) => comment(id)) }));
    const list = () => within(screen.getByRole("list", { name: "Comments" })).getAllByRole("listitem");
    expect(list().map((li) => li.textContent)).toEqual([expect.stringContaining("comment c"), expect.stringContaining("comment d"), expect.stringContaining("comment e")]);
    fireEvent.click(screen.getByRole("button", { name: "View all 5 comments" }));
    expect(list()).toHaveLength(5);
  });

  it("says so when the reactions cannot load", async () => {
    vi.mocked(getSocial).mockRejectedValue(new Error("Internal error"));
    render(<VideoSocial videoId="W02#v1" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Could not load reactions (Internal error).");
  });
});
