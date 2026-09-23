"use client";

import { type FormEvent, useState } from "react";

import { setToiletByes } from "@/lib/api/admin";
import type { Ledger } from "@/lib/api/ledger";
import { useAlerts } from "@/lib/alerts/alerts";
import { DEFAULT_TOILET_CONFIG } from "@/lib/league/brackets";
import { useAdminAction } from "./use-admin-action";

const SEEDS = [9, 10, 11, 12, 13, 14];

export function ToiletPanel({ ledger }: { ledger: Ledger }) {
  const { run } = useAdminAction();
  const { notify } = useAlerts();
  const [first, second] = ledger.toiletByes ?? DEFAULT_TOILET_CONFIG.byes;
  const [byes, setByes] = useState<[number, number]>([first, second]);
  const [busy, setBusy] = useState(false);
  const same = byes[0] === byes[1];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (await run(() => setToiletByes(byes))) {
      notify({ title: "Toilet Bowl", body: `Seeds ${byes[0]} and ${byes[1]} get round-one byes.`, icon: "info" });
    }
    setBusy(false);
  };

  const seedSelect = (label: string, i: 0 | 1) => (
    <label className="cp-field">
      {label}
      <select
        className="xp-select"
        value={byes[i]}
        aria-invalid={same || undefined}
        onChange={(e) => setByes(i === 0 ? [Number(e.target.value), byes[1]] : [byes[0], Number(e.target.value)])}
      >
        {SEEDS.map((s) => (
          <option key={s} value={s}>
            Seed {s}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form className="grid gap-3" onSubmit={(e) => void submit(e)}>
      <p>Seeds 9 to 14 play the toilet bowl. Two of them sit out round one and meet the round-one losers.</p>
      <div className="cp-inline">
        {seedSelect("First bye", 0)}
        {seedSelect("Second bye", 1)}
        <button type="submit" className="xp-button" disabled={same || busy}>
          {busy ? "Saving..." : "Save byes"}
        </button>
      </div>
      {same && (
        <p role="alert" className="cp-error">
          Pick two different seeds.
        </p>
      )}
    </form>
  );
}
