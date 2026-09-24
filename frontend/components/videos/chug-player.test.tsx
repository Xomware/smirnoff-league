import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/social")>()),
  getSocial: vi.fn(),
}));
vi.mock("@/lib/profile/use-profile", () => ({
  useProfile: () => ({ myRosterId: 4, me: null }),
}));
vi.mock("@/lib/league/use-league", () => ({
  useLeague: () => ({ teamFor: (r: number) => ({ name: `Team ${r}`, avatarUrl: null }) }),
}));

import { getSocial, REACTIONS, type VideoSocial as Social } from "@/lib/api/social";
import type { Video } from "@/lib/api/videos";
import { PHONE } from "@/lib/use-media-query";
import { ChugPlayer } from "./ChugPlayer";

const VIDEO: Video = { mediaId: "W02#v1", iceIds: [], week: 2, rosterIds: [3], createdAt: "2026-09-21T12:00:00+00:00", bytes: 1, url: "https://media.test/1.mp4" };
const SOCIAL: Social = {
  reactions: Object.fromEntries(REACTIONS.map((t) => [t, { count: 0, mine: false, by: [] as string[] }])) as Social["reactions"],
  comments: [],
};

const phone = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query === PHONE,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

const onClose = vi.fn();

// Callers unmount the player on close, which stops it hearing its own Back.
function Host() {
  const [open, setOpen] = useState(true);
  return open ? (
    <ChugPlayer
      video={VIDEO}
      label="Team 3 · Week 2"
      onError={() => {}}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
    />
  ) : null;
}

const mount = async () => {
  render(<Host />);
  await screen.findByRole("group", { name: "Reactions" });
  return screen.getByRole("dialog", { name: "Team 3 · Week 2" });
};

beforeEach(() => {
  vi.mocked(getSocial).mockResolvedValue(SOCIAL);
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  vi.clearAllMocks();
  phone(false);
});

describe("ChugPlayer", () => {
  it("plays inline, so iOS never takes it fullscreen", async () => {
    const player = await mount();
    expect(player.querySelector("video")!.hasAttribute("playsinline")).toBe(true);
  });

  it("on a phone, puts a close button in the title and reactions and comments below the video", async () => {
    phone(true);
    const player = await mount();
    const title = player.querySelector(".xp-dialog-title")!;
    const close = within(player).getByRole("button", { name: "Close" });
    expect(title.contains(close)).toBe(true);
    expect(document.activeElement).toBe(close);
    const video = player.querySelector("video")!;
    const social = within(player).getByRole("region", { name: "Reactions and comments" });
    expect(video.compareDocumentPosition(social) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(social).getByRole("textbox")).toBeTruthy();

    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the desktop's single Close under the comments", async () => {
    const player = await mount();
    const close = within(player).getByRole("button", { name: "Close" });
    expect(player.querySelector(".xp-dialog-title")!.contains(close)).toBe(false);
  });

  it("closes on the browser's Back instead of leaving the page", async () => {
    await mount();
    expect(window.history.state).toMatchObject({ chugPlayer: true });
    window.history.back();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(window.history.state?.chugPlayer).toBeUndefined();
  });

  it("drops its history entry when closed another way", async () => {
    const player = await mount();
    const before = window.history.length;
    fireEvent.keyDown(player, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    await waitFor(() => expect(window.history.state?.chugPlayer).toBeUndefined());
    expect(window.history.length).toBe(before);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
