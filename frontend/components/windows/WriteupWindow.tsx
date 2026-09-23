"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DrillLink } from "@/components/views/drill-link";
import { NewspaperIcon } from "@/components/xp/icons";
import type { WindowParams } from "@/lib/desktop/windows";
import { useProfile } from "@/lib/profile/use-profile";
import { useWriteups } from "@/lib/writeups/use-writeups";
import { UploadEdition } from "./UploadEdition";

import "./writeup.css";

// Pages render ~1400px wide; US Letter proportions reserve the height until
// the real image arrives.
const PAGE_W = 1400;
const PAGE_H = 1812;

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

interface WriteupWindowProps {
  params: WindowParams;
}

export function WriteupWindow({ params }: WriteupWindowProps) {
  const { state, refresh, onPageError } = useWriteups();
  const isAdmin = useProfile().me?.isAdmin ?? false;
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const archive = useRef<HTMLElement>(null);
  const week = params.week === undefined ? undefined : Number(params.week);

  useEffect(() => {
    if (!archiveOpen) return;
    archive.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setArchiveOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [archiveOpen]);

  if (state.status === "loading") return <p role="status">Fetching the latest edition...</p>;
  if (state.status === "error") {
    return (
      <div role="alert" className="grid justify-items-start gap-2">
        <p>Could not load the News Drop ({state.message}).</p>
        <button type="button" className="xp-button" onClick={refresh}>
          Try again
        </button>
      </div>
    );
  }

  const { writeups } = state;
  const shown = week === undefined ? writeups[0] : writeups.find((w) => w.week === week);
  // On a narrow window the archive is a drawer. It portals out so it can
  // cover the viewport, and the React tree keeps its drill contexts.
  const nav = (
    <nav ref={archive} aria-label="Archive" className="writeup-archive">
      <h3 className="xp-group-title">Archive</h3>
      {writeups.length === 0 ? (
        <p className="italic">Nothing filed yet.</p>
      ) : (
        <ul onClick={() => setArchiveOpen(false)}>
          {writeups.map((w) => (
            <li key={w.mediaId} aria-current={w === shown ? "page" : undefined}>
              <DrillLink to={{ kind: "writeup", week: w.week }}>
                <span className="grid">
                  <span className="font-bold">Week {w.week}</span>
                  <span className="truncate">{w.title}</span>
                </span>
              </DrillLink>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );

  return (
    <div className="writeup">
      {archiveOpen
        ? createPortal(
            <div className="writeup-drawer">
              <div className="writeup-scrim" aria-hidden onClick={() => setArchiveOpen(false)} />
              {nav}
            </div>,
            document.body,
          )
        : nav}
      <div className="writeup-main">
        <header className="writeup-head">
          <div className="min-w-0 flex-1">
            {shown && (
              <>
                <h3 className="writeup-title">{shown.title}</h3>
                <p>
                  Week {shown.week} &middot; {shortDate(shown.publishedAt)} &middot; {shown.pages.length} pages
                </p>
              </>
            )}
          </div>
          {writeups.length > 0 && (
            <button type="button" className="xp-button writeup-archive-toggle" aria-expanded={archiveOpen} onClick={() => setArchiveOpen(true)}>
              Archive
            </button>
          )}
          {isAdmin && (
            <button type="button" className="xp-button" onClick={() => setUploading(true)}>
              Upload edition
            </button>
          )}
        </header>
        {!shown ? (
          <p className="writeup-empty">
            <NewspaperIcon width={48} height={48} />
            {writeups.length === 0 ? "No edition yet. The commish is typing..." : `No edition for Week ${week}.`}
          </p>
        ) : (
          <ol aria-label="Pages" className="writeup-pages">
            {shown.pages.map((src, i) => (
              <li key={src}>
                {/* Presigned URLs have to reach S3 byte for byte. */}
                <Image
                  unoptimized
                  src={src}
                  alt={`Page ${i + 1} of ${shown.pages.length}`}
                  width={PAGE_W}
                  height={PAGE_H}
                  loading={i === 0 ? "eager" : "lazy"}
                  onError={onPageError}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
      {/* Portalled so no window stacked above this one can cover the modal. */}
      {uploading &&
        createPortal(
          <UploadEdition
            defaultWeek={Math.min(17, (writeups[0]?.week ?? 0) + 1)}
            onPublished={refresh}
            onClose={() => setUploading(false)}
          />,
          document.body,
        )}
    </div>
  );
}
