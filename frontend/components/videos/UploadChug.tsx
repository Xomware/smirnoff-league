"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

import { ErrorIcon, IceBottleIcon } from "@/components/xp/icons";
import { track } from "@/lib/activity/tracker";
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
import { ChugTimeForm, chugTime } from "./ChugTime";
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

// The server only lets a video through when the uploader owns one of its ices.
const MINE_REQUIRED = "Tick at least one of your own team's ices. Other teams can only ride along.";

export const teamList = (names: string[]) =>
  names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

function failureCopy(stage: Stage, err: Error): string {
  const status = err instanceof ApiError ? err.status : 0;
  if (stage === "presign" && status === 403) return MINE_REQUIRED;
  if (stage === "presign" && status === 400) return `The server refused this upload (${err.message}).`;
  if (stage === "presign" && status === 404) return "One of those ices is no longer on the ledger.";
  if (stage === "upload") return `The video didn't make it to the server (${err.message}). Check your connection and retry.`;
  if (stage === "confirm" && status === 409) return "The video never finished landing on the server. Retry the upload.";
  return err.message;
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

interface IcePicksProps {
  legend: string;
  ices: LedgerIce[];
  picked: string[];
  week?: number;
  label: (ice: LedgerIce) => string;
  onToggle: (iceId: string) => void;
}

// One video covers one week, so ices from other weeks lock once any is ticked.
function IcePicks({ legend, ices, picked, week, label, onToggle }: IcePicksProps) {
  return (
    <fieldset className="chug-picks">
      <legend>{legend}</legend>
      {ices.map((ice) => (
        <label key={ice.iceId}>
          <input
            type="checkbox"
            value={ice.iceId}
            checked={picked.includes(ice.iceId)}
            disabled={week !== undefined && ice.week !== week}
            onChange={() => onToggle(ice.iceId)}
          />
          {label(ice)}
        </label>
      ))}
    </fieldset>
  );
}

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
  /** Ices ticked when the dialog opens. */
  initialIceIds?: string[];
  onClose: () => void;
}

export function UploadChug({ ices, initialIceIds = [], onClose }: UploadChugProps) {
  const { data, teamFor } = useLeague();
  const { myRosterId, me } = useProfile();
  const phone = useMediaQuery(PHONE);
  const choices = ices.filter((i) => canUpload(i, myRosterId, me?.isAdmin ?? false));
  const [picked, setPicked] = useState(initialIceIds);
  const [withOthers, setWithOthers] = useState(false);
  const [team, setTeam] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "form" });
  const [timed, setTimed] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const busy = phase.step === "uploading" || phase.step === "confirming";

  const byId = new Map(ices.map((i) => [i.iceId, i]));
  const mine = new Set(choices.map((i) => i.iceId));
  const week = byId.get(picked[0])?.week;
  const others = ices.filter((i) => i.week === week && i.status === "owed" && !mine.has(i.iceId));
  const otherTeams = [...new Set(others.map((i) => i.rosterId))].sort((a, b) => teamFor(a).name.localeCompare(teamFor(b).name));
  const covers = teamList([...new Set(picked.flatMap((id) => byId.get(id)?.rosterId ?? []))].map((r) => teamFor(r).name));
  const label = (ice: LedgerIce) => iceLabel(ice, teamFor, data?.players ?? {});
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  // The time is the uploader's own; teams riding along time their chugs themselves.
  const ownPicked = picked.filter((id) => byId.get(id)?.rosterId === myRosterId);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input:not(:disabled)")?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    if (phase.step === "done" || phase.step === "failed") box.current?.querySelector<HTMLElement>("input, button")?.focus();
  }, [phase.step]);

  const send = async (video: File) => {
    let stage: Stage = "presign";
    setPhase({ step: "uploading", progress: 0 });
    try {
      const { mediaId, ...post } = await presignVideo({ iceIds: picked, contentType: video.type, bytes: video.size });
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
    track("upload", `chug:${picked.join(",")}`);
    play("chord");
    refreshLedger();
    refreshVideos();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (picked.length === 0) return setPhase({ step: "form", error: "Tick at least one ice." });
    if (!picked.some((id) => mine.has(id))) return setPhase({ step: "form", error: MINE_REQUIRED });
    if (!file || !file.type.startsWith("video/")) return setPhase({ step: "form", error: "Choose a video file." });
    if (file.size > MAX_VIDEO_BYTES) return setPhase({ step: "form", error: `The video is ${mb(file.size)} MB. The limit is 200 MB.` });
    void send(file);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !busy) return onClose();
    if (e.key !== "Tab") return;
    const all = [...(box.current?.querySelectorAll<HTMLElement>("select, input:not(:disabled), button:not(:disabled)") ?? [])];
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
              <IcePicks legend="Your ices" ices={choices} picked={picked} week={week} label={label} onToggle={toggle} />
            )}
            {otherTeams.length > 0 &&
              (withOthers ? (
                <div className="grid gap-2">
                  <label className="flex items-center gap-2 font-bold">
                    Team
                    <select className="xp-select min-w-0 flex-1" value={team} onChange={(e) => setTeam(e.target.value)}>
                      <option value="">Pick a team</option>
                      {otherTeams.map((id) => (
                        <option key={id} value={id}>
                          {teamFor(id).name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {team && (
                    <IcePicks
                      legend={`${teamFor(Number(team)).name} ices`}
                      ices={others.filter((i) => i.rosterId === Number(team))}
                      picked={picked}
                      label={label}
                      onToggle={toggle}
                    />
                  )}
                </div>
              ) : (
                <button type="button" className="xp-button justify-self-start" onClick={() => setWithOthers(true)}>
                  Chugged with someone?
                </button>
              ))}
            {picked.length > 0 && <p className="xp-note">Covers {covers}.</p>}
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
            {phase.step === "done" && <p>Chug logged for {covers}.</p>}
            {phase.step === "done" &&
              ownPicked.length > 0 &&
              (timed === null ? <ChugTimeForm iceIds={ownPicked} onSaved={setTimed} /> : <p>Time saved: {chugTime(timed)}.</p>)}
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
