"use client";

import { type KeyboardEvent, useEffect, useId, useRef } from "react";

import { MediaPlayerIcon } from "@/components/xp/icons";
import type { Video } from "@/lib/api/videos";

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

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector("button")?.focus();
    return () => opener?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab") return;
    const all = [...(box.current?.querySelectorAll<HTMLElement>("video, button") ?? [])];
    const edge = e.shiftKey ? all[0] : all[all.length - 1];
    if (document.activeElement !== edge) return;
    e.preventDefault();
    (e.shiftKey ? all[all.length - 1] : all[0]).focus();
  };

  return (
    <div className="xp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} className="xp-dialog chug-player" onKeyDown={onKeyDown}>
        <h2 className="xp-dialog-title flex items-center gap-1.5">
          <MediaPlayerIcon className="shrink-0" />
          <span id={titleId} className="truncate">
            {label}
          </span>
        </h2>
        <video src={`${video.url}#t=0.1`} controls playsInline preload="metadata" autoPlay onError={onError} aria-label={`${label} chug`} />
        <div className="flex justify-end p-2">
          <button type="button" className="xp-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
