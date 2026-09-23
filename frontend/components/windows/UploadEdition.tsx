"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { uploadFile } from "@/lib/api/upload";
import { presignWriteup, publishWriteup } from "@/lib/api/writeups";

const MAX_BYTES = 30 * 1024 * 1024;
const POLL_MS = 3000;
// Rendering takes seconds; a row still pending after three minutes means the
// render Lambda died without marking it failed.
const MAX_POLLS = 60;

// Keyed by the render Lambda's failReason values (backend/lambdas/writeup_render).
const FAIL_COPY: Record<string, string> = {
  "too many pages": "That PDF has more than 40 pages. Split it up and re-upload.",
  "bad page size": "A page in that PDF has a broken size. Export it again and re-upload.",
  "render error": "The PDF couldn't be rendered. Try exporting it again and re-uploading.",
};

type Phase =
  | { step: "form"; error?: string }
  | { step: "uploading"; progress: number }
  | { step: "rendering"; mediaId: string }
  | { step: "rendered"; mediaId: string; published: boolean; busy: boolean; error?: string }
  | { step: "failed"; reason?: string };

interface UploadEditionProps {
  defaultWeek: number;
  onPublished: () => void;
  onClose: () => void;
}

export function UploadEdition({ defaultWeek, onPublished, onClose }: UploadEditionProps) {
  const [phase, setPhase] = useState<Phase>({ step: "form" });
  const [week, setWeek] = useState(String(defaultWeek));
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector("input")?.focus();
    return () => opener?.focus();
  }, []);

  // The file input remounts empty on the way back to the form, so forget the
  // old file rather than silently upload it again.
  const backToForm = (error?: string) => {
    setFile(null);
    setPhase({ step: "form", error });
  };

  const rendering = phase.step === "rendering" ? phase.mediaId : null;
  useEffect(() => {
    if (!rendering) return;
    let live = true;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      // A failed poll is retried on the next tick; only the row's status ends it.
      const row = await publishWriteup(rendering, false).catch(() => null);
      if (!live) return;
      if (row?.status === "rendered") return setPhase({ step: "rendered", mediaId: rendering, published: false, busy: false });
      if (row?.status === "failed") return setPhase({ step: "failed", reason: row.failReason });
      if (++polls >= MAX_POLLS) return backToForm("Rendering is taking too long. Try the upload again.");
      timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [rendering]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || file.type !== "application/pdf") return setPhase({ step: "form", error: "Choose a PDF file." });
    if (file.size > MAX_BYTES) return setPhase({ step: "form", error: "The PDF is over 30 MB." });
    setPhase({ step: "uploading", progress: 0 });
    try {
      const { mediaId, ...post } = await presignWriteup({ week: Number(week), title: title.trim() });
      await uploadFile(post, file, (progress) => setPhase({ step: "uploading", progress }));
      setPhase({ step: "rendering", mediaId });
    } catch (err) {
      backToForm((err as Error).message);
    }
  };

  const setPublished = async (mediaId: string, published: boolean) => {
    setPhase({ step: "rendered", mediaId, published: !published, busy: true });
    const result = await publishWriteup(mediaId, published).catch((err: Error) => err);
    if (result instanceof Error) {
      return setPhase({ step: "rendered", mediaId, published: !published, busy: false, error: result.message });
    }
    setPhase({ step: "rendered", mediaId, published, busy: false });
    onPublished();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab") return;
    const all = [...(box.current?.querySelectorAll<HTMLElement>("input, button:not(:disabled)") ?? [])];
    const edge = e.shiftKey ? all[0] : all[all.length - 1];
    if (document.activeElement !== edge) return;
    e.preventDefault();
    (e.shiftKey ? all[all.length - 1] : all[0]).focus();
  };

  return (
    <div className="xp-backdrop">
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} className="xp-dialog upload-edition" onKeyDown={onKeyDown}>
        <h2 id={titleId} className="xp-dialog-title">
          Upload edition
        </h2>
        {phase.step === "form" ? (
          <form className="grid gap-3 p-3" onSubmit={(e) => void submit(e)}>
            <label className="grid gap-1 font-bold">
              Week
              <input className="xp-input" type="number" min={1} max={17} required value={week} onChange={(e) => setWeek(e.target.value)} />
            </label>
            <label className="grid gap-1 font-bold">
              Title
              <input className="xp-input" maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="grid gap-1 font-bold">
              PDF
              <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {phase.error && <p role="alert" className="upload-error">{phase.error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="xp-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="xp-button">
                Upload
              </button>
            </div>
          </form>
        ) : (
          <div aria-live="polite" className="grid gap-3 p-3">
            {phase.step === "uploading" && (
              <>
                <p>Uploading {file?.name}...</p>
                <div
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(phase.progress * 100)}
                  className="upload-progress"
                >
                  <span style={{ width: `${phase.progress * 100}%` }} />
                </div>
              </>
            )}
            {phase.step === "rendering" && <p role="status">Uploaded. Rendering pages...</p>}
            {phase.step === "failed" && (
              <p role="alert" className="upload-error">
                {FAIL_COPY[phase.reason ?? ""] ?? "The PDF could not be rendered. Export it again and re-upload."}
              </p>
            )}
            {phase.step === "rendered" && (
              <>
                <p role="status">{phase.published ? "Published. Everyone can read it now." : "Rendered. Not published yet."}</p>
                {phase.error && <p role="alert" className="upload-error">{phase.error}</p>}
              </>
            )}
            <div className="flex justify-end gap-2">
              {phase.step === "failed" && (
                <button type="button" className="xp-button" onClick={() => backToForm()}>
                  Try another file
                </button>
              )}
              {phase.step === "rendered" && (
                <button
                  type="button"
                  className="xp-button"
                  disabled={phase.busy}
                  onClick={() => void setPublished(phase.mediaId, !phase.published)}
                >
                  {phase.published ? "Unpublish" : "Publish"}
                </button>
              )}
              <button type="button" className="xp-button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
