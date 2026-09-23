"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LedgerIce } from "@/lib/api/ledger";
import { listVideos, type Video } from "@/lib/api/videos";

export const videoFor = (videos: Video[], ice: LedgerIce): Video | undefined =>
  videos.find((v) => v.mediaId === ice.videoId) ?? videos.find((v) => v.iceIds.includes(ice.iceId));

export type VideosState = { status: "loading" } | { status: "ok"; videos: Video[] } | { status: "error"; message: string };

// Long enough that a video that is simply broken cannot loop the list call.
const STALE_MS = 60_000;

const listeners = new Set<() => void>();

export function refreshVideos() {
  listeners.forEach((fn) => fn());
}

export function useVideos() {
  const [state, setState] = useState<VideosState>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const requestedAt = useRef(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);

  useEffect(() => {
    let live = true;
    requestedAt.current = Date.now();
    listVideos().then(
      (videos) => live && setState({ status: "ok", videos }),
      (e: Error) => live && setState({ status: "error", message: e.message }),
    );
    return () => {
      live = false;
    };
  }, [version]);

  // A <video> error carries no status, so treat a failure on an old list as an
  // expired presigned URL. Every video fails at once, so bump the clock here.
  const onVideoError = useCallback(() => {
    if (Date.now() - requestedAt.current < STALE_MS) return;
    requestedAt.current = Date.now();
    refreshVideos();
  }, []);

  return { state, onVideoError };
}
