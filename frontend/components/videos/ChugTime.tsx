"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { type LedgerIce, logChugTime } from "@/lib/api/ledger";
import { refreshLedger } from "@/lib/ices/use-ledger";

import "./videos.css";

// Players time their own team's chugs once they're done; admins can time any.
export const canTime = (ice: LedgerIce, myRosterId: number | null, isAdmin: boolean) =>
  ice.status === "completed" && (isAdmin || ice.rosterId === myRosterId);

export const chugTime = (seconds: number) => `${seconds.toFixed(1)}s`;

export function ChugTimeButton({ ice, onClick }: { ice: LedgerIce; onClick: () => void }) {
  return (
    <button type="button" className="xp-button chug-row-button" onClick={onClick}>
      {ice.chugSeconds === undefined ? "Add time" : "Edit time"}
    </button>
  );
}

interface ChugTimeFormProps {
  iceIds: string[];
  initial?: number;
  autoFocus?: boolean;
  onSaved: (seconds: number) => void;
  onCancel?: () => void;
}

export function ChugTimeForm({ iceIds, initial, autoFocus, onSaved, onCancel }: ChugTimeFormProps) {
  const [value, setValue] = useState(initial === undefined ? "" : initial.toFixed(1));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const seconds = Math.round(Number(value) * 10) / 10;
    if (!(seconds > 0 && seconds < 600)) return setError("Enter the seconds: above 0 and under 600.");
    setBusy(true);
    const failed = await Promise.all(iceIds.map((iceId) => logChugTime(iceId, seconds))).then(
      () => null,
      (err: Error) => err,
    );
    setBusy(false);
    refreshLedger();
    if (failed) return setError(`The time didn't save (${failed.message}).`);
    onSaved(seconds);
  };

  return (
    <form className="grid gap-2" onSubmit={(e) => void submit(e)}>
      <label htmlFor={id} className="font-bold">
        How long did it take?
      </label>
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="xp-input chug-seconds"
          min="0.1"
          max="599.9"
          step="0.1"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        seconds
      </span>
      {error && (
        <p role="alert" className="upload-error">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="xp-button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="xp-button" disabled={busy}>
          {busy ? "Saving..." : "Save time"}
        </button>
      </div>
    </form>
  );
}

export function ChugTimeDialog({ ice, label, onClose }: { ice: LedgerIce; label: string; onClose: () => void }) {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus();
  }, []);

  return createPortal(
    <div className="xp-backdrop">
      <div role="dialog" aria-modal="true" aria-label="Chug time" className="xp-dialog chug-dialog" onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <h2 className="xp-dialog-title">Chug time</h2>
        <div className="grid gap-2 p-3">
          <p>{label}</p>
          <ChugTimeForm iceIds={[ice.iceId]} initial={ice.chugSeconds} autoFocus onSaved={onClose} onCancel={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
