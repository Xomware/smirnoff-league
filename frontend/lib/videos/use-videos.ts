"use client";

import { useCallback } from "react";

import type { LedgerIce } from "@/lib/api/ledger";
import { listVideos, type Video } from "@/lib/api/videos";
import { sharedResource } from "@/lib/shared-resource";

export const videoFor = (videos: Video[], ice: LedgerIce): Video | undefined =>
  videos.find((v) => v.mediaId === ice.videoId) ?? videos.find((v) => v.iceIds.includes(ice.iceId));

export type VideosState = { status: "loading" } | { status: "ok"; videos: Video[] } | { status: "error"; message: string };

// Presigned GETs expire an hour after the list call; refetch well before that.
const MAX_AGE_MS = 50 * 60_000;
// Long enough that a video that is simply broken cannot loop the list call.
const STALE_MS = 60_000;

const videos = sharedResource(() => listVideos().then((v) => ({ status: "ok" as const, videos: v })), MAX_AGE_MS);

export const refreshVideos = videos.refresh;

export function useVideos() {
  const state: VideosState = videos.use();

  // A <video> error carries no status, so treat a failure on an old list as an
  // expired presigned URL. Every video fails at once; the refresh resets the age.
  const onVideoError = useCallback(() => {
    if (videos.age() >= STALE_MS) refreshVideos();
  }, []);

  return { state, onVideoError };
}
