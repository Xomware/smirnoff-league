"use client";

import { type KeyboardEvent, useEffect, useEffectEvent, useId, useRef } from "react";

import { CloseGlyph, MediaPlayerIcon } from "@/components/xp/icons";
import type { Video } from "@/lib/api/videos";
import { PHONE, useMediaQuery } from "@/lib/use-media-query";
import { fitVisualViewport } from "@/lib/visual-viewport";
import { VideoSocial } from "./VideoSocial";

import "./videos.css";

interface ChugPlayerProps {
  video: Video;
  label: string;
  onError: () => void;
  onClose: () => void;
}

// A Windows Media Player box for one chug. It plays from the caller's video list,
// so a refetched presigned URL swaps in without closing it.
export function ChugPlayer({ video, label, onError, onClose }: ChugPlayerProps) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const phone = useMediaQuery(PHONE);
  const dismiss = useEffectEvent(onClose);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector("button")?.focus();
    return () => opener?.focus();
  }, []);

  // An entry of its own, so Back and the iOS edge swipe close the player
  // rather than leave the page. The guard stops a Strict Mode remount pushing twice.
  useEffect(() => {
    if (!window.history.state?.chugPlayer) window.history.pushState({ ...window.history.state, chugPlayer: true }, "");
    const onPop = () => dismiss();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const close = () => {
    if (window.history.state?.chugPlayer) window.history.back();
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return close();
    if (e.key !== "Tab") return;
    const all = [...(box.current?.querySelectorAll<HTMLElement>("video, button:not(:disabled), textarea") ?? [])];
    const edge = e.shiftKey ? all[0] : all[all.length - 1];
    if (document.activeElement !== edge) return;
    e.preventDefault();
    (e.shiftKey ? all[all.length - 1] : all[0]).focus();
  };

  return (
    <div ref={fitVisualViewport} className="xp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} className="xp-dialog chug-player" onKeyDown={onKeyDown}>
        <h2 className="xp-dialog-title flex items-center gap-1.5">
          <MediaPlayerIcon className="shrink-0" />
          <span id={titleId} className="min-w-0 flex-1 truncate">
            {label}
          </span>
          {phone && (
            <button type="button" className="xp-control xp-control-close chug-player-x" aria-label="Close" onClick={close}>
              <CloseGlyph />
            </button>
          )}
        </h2>
        <video src={`${video.url}#t=0.1`} controls playsInline preload="metadata" autoPlay onError={onError} aria-label={`${label} chug`} />
        <VideoSocial videoId={video.mediaId} />
        {!phone && (
          <div className="flex justify-end p-2">
            <button type="button" className="xp-button" onClick={close}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
