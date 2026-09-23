"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

import { ErrorIcon, IceBottleIcon } from "@/components/xp/icons";
import type { LedgerIce } from "@/lib/api/ledger";
import { uploadFile } from "@/lib/api/upload";
import { ApiError } from "@/lib/api/users";
import { confirmVideo, MAX_VIDEO_BYTES, presignVideo } from "@/lib/api/videos";
import { refreshLedger } from "@/lib/ices/use-ledger";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { play } from "@/lib/sound/sound";
import { PHONE, useMediaQuery } from "@/lib/use-media-query";
import { refreshVideos } from "@/lib/videos/use-videos";
import { iceLabel } from "./ice-label";

import "@/components/windows/writeup.css";
import "./videos.css";

type Phase =
  | { step: "form"; error?: string }
  | { step: "uploading"; progress: number }
  | { step: "confirming" }
  | { step: "done" }
  | { step: "failed"; error: string };

type Stage = "presign" | "upload" | "confirm";

// Anyone can upload for their own team's owed ices; admins backfill any ice.
export const canUpload = (ice: LedgerIce, myRosterId: number | null, isAdmin: boolean) =>
  isAdmin || (ice.rosterId === myRosterId && ice.status === "owed");

// The row button beside an owed ice. Phone rows are too tight for both words.
export function UploadChugButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="xp-button chug-row-button" aria-label="Upload chug" onClick={onClick}>
      Upload<span className="max-md:hidden"> chug</span>
    </button>
  );
}

function failureCopy(stage: Stage, err: Error): string {
  const status = err instanceof ApiError ? err.status : 0;
  if (stage === "presign" && status === 403) return "That ice isn't yours. You can only upload chugs for your own team's ices.";
  if (stage === "presign" && status === 400) return `The server refused this upload (${err.message}).`;
  if (stage === "presign" && status === 404) return "That ice is no longer on the ledger.";
  if (stage === "upload") return `The video didn't make it to the server (${err.message}). Check your connection and retry.`;
  if (stage === "confirm" && status === 409) return "The video never finished landing on the server. Retry the upload.";
  return err.message;
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

function CopyAnimation() {
  const folder = "M2 6h9l3 3h16v19H2z";
  return (
    <svg viewBox="0 0 240 40" className="chug-copy" aria-hidden focusable="false">
      <path d={folder} className="fill-(--xp-gold) stroke-(--xp-wood)" />
      <g transform="translate(208 0)">
        <path d={folder} className="fill-(--xp-gold) stroke-(--xp-wood)" />
        <rect x="9" y="14" width="14" height="8" className="fill-(--smirnoff-red)" />
      </g>
      <g className="chug-fly">
        <path d="M44 8h14l4 4v18H44z" className="fill-(--xp-cream) stroke-(--xp-text)" />
        <path d="M49 15v9l7-4.5z" className="fill-(--xp-title)" />
      </g>
    </svg>
  );
}

interface UploadChugProps {
  ices: LedgerIce[];
  iceId?: string;
  onClose: () => void;
}

export function UploadChug({ ices, iceId, onClose }: UploadChugProps) {
  const { data, teamFor } = useLeague();
  const { myRosterId, me } = useProfile();
  const phone = useMediaQuery(PHONE);
  const choices = ices.filter((i) => canUpload(i, myRosterId, me?.isAdmin ?? false));
  const [picked, setPicked] = useState(iceId ?? choices[0]?.iceId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "form" });
  const box = useRef<HTMLDivElement>(null);
  const busy = phase.step === "uploading" || phase.step === "confirming";

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector("select")?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    if (phase.step === "done" || phase.step === "failed") box.current?.querySelector<HTMLElement>("button")?.focus();
  }, [phase.step]);

  const send = async (video: File) => {
    let stage: Stage = "presign";
    setPhase({ step: "uploading", progress: 0 });
    try {
      const { mediaId, ...post } = await presignVideo({ iceId: picked, contentType: video.type, bytes: video.size });
      stage = "upload";
      await uploadFile(post, video, (progress) => setPhase({ step: "uploading", progress }));
      stage = "confirm";
      setPhase({ step: "confirming" });
      await confirmVideo(mediaId);
    } catch (err) {
      play("error");
      return setPhase({ step: "failed", error: failureCopy(stage, err as Error) });
    }
    setPhase({ step: "done" });
    play("chord");
    refreshLedger();
    refreshVideos();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file || !file.type.startsWith("video/")) return setPhase({ step: "form", error: "Choose a video file." });
    if (file.size > MAX_VIDEO_BYTES) return setPhase({ step: "form", error: `The video is ${mb(file.size)} MB. The limit is 200 MB.` });
    void send(file);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !busy) return onClose();
    if (e.key !== "Tab") return;
    const all = [...(box.current?.querySelectorAll<HTMLElement>("select, input, button:not(:disabled)") ?? [])];
    const edge = e.shiftKey ? all[0] : all[all.length - 1];
    if (document.activeElement !== edge) return;
    e.preventDefault();
    (e.shiftKey ? all[all.length - 1] : all[0]).focus();
  };

  const title = { form: "Upload chug", uploading: "Copying...", confirming: "Copying...", done: "ICE.EXE", failed: "Copy failed" }[phase.step];
  const pickFile = (files: FileList | null) => setFile(files?.[0] ?? null);

  return (
    <div className="xp-backdrop">
      <div ref={box} role="dialog" aria-modal="true" aria-label="Upload chug" className="xp-dialog chug-dialog" onKeyDown={onKeyDown}>
        <h2 className="xp-dialog-title">{title}</h2>
        {phase.step === "form" ? (
          <form className="grid gap-3 p-3" onSubmit={submit}>
            {choices.length === 0 ? (
              <p>Your team owes nothing right now. Nothing to upload.</p>
            ) : (
              <label className="grid gap-1 font-bold">
                Ice
                <select className="xp-select" value={picked} onChange={(e) => setPicked(e.target.value)}>
                  {choices.map((ice) => (
                    <option key={ice.iceId} value={ice.iceId}>
                      {iceLabel(ice, teamFor, data?.players ?? {})}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-1 font-bold">
              Video file
              <input type="file" accept="video/*" onChange={(e) => pickFile(e.target.files)} />
            </label>
            {phone && (
              <label className="grid gap-1 font-bold">
                Record with camera
                <input type="file" accept="video/*" capture="environment" onChange={(e) => pickFile(e.target.files)} />
              </label>
            )}
            <p className="xp-note">Up to 200 MB. Everyone signed in can watch it.</p>
            {phase.error && (
              <p role="alert" className="upload-error">
                {phase.error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="xp-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="xp-button" disabled={choices.length === 0}>
                Upload
              </button>
            </div>
          </form>
        ) : (
          <div aria-live="polite" className="grid gap-3 p-3">
            {busy && (
              <>
                <CopyAnimation />
                <p className="truncate font-bold">{file?.name}</p>
                <p>From My Videos to ICE.EXE</p>
                <div
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={phase.step === "uploading" ? Math.round(phase.progress * 100) : 100}
                  className="upload-progress"
                >
                  <span style={{ width: `${phase.step === "uploading" ? phase.progress * 100 : 100}%` }} />
                </div>
                <p role="status">
                  {phase.step === "uploading"
                    ? `${mb((file?.size ?? 0) * phase.progress)} of ${mb(file?.size ?? 0)} MB copied`
                    : "Marking the ice completed..."}
                </p>
              </>
            )}
            {phase.step === "done" && (
              <p className="flex items-center gap-3 font-bold">
                <IceBottleIcon height={40} />
                ICE.EXE completed successfully
              </p>
            )}
            {phase.step === "failed" && (
              <p role="alert" className="upload-error flex items-start gap-3">
                <ErrorIcon width={32} height={32} className="shrink-0" />
                {phase.error}
              </p>
            )}
            {!busy && (
              <div className="flex justify-end gap-2">
                {phase.step === "failed" && file && (
                  <button type="button" className="xp-button" onClick={() => void send(file)}>
                    Retry
                  </button>
                )}
                <button type="button" className="xp-button" onClick={onClose}>
                  Close
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
