"use client";

import { useState } from "react";

import { finalizeWeek, setWeekRules } from "@/lib/api/admin";
import type { Ledger } from "@/lib/api/ledger";
import { defaultWeekSettings, type WeekSettings } from "@/lib/ices/compute";
import { useAdminAction } from "./use-admin-action";

const WEEKS = Array.from({ length: 17 }, (_, i) => i + 1);

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function WeekRulesPanel({ ledger }: { ledger: Ledger }) {
  const { run, confirm } = useAdminAction();
  const [edits, setEdits] = useState<{ base: Ledger; rules: Record<number, Partial<WeekSettings>> }>({ base: ledger, rules: {} });
  const [busy, setBusy] = useState<number | null>(null);
  const stored = new Map(ledger.weeks.map((w) => [w.week, w]));
  const pending = edits.base === ledger ? edits.rules : {};

  const rulesFor = (week: number): WeekSettings => {
    const fallback = defaultWeekSettings(week);
    const row = stored.get(week);
    return {
      iceRulesActive: pending[week]?.iceRulesActive ?? row?.iceRulesActive ?? fallback.iceRulesActive,
      lowestScope: pending[week]?.lowestScope ?? row?.lowestScope ?? fallback.lowestScope,
    };
  };

  const finalize = async (week: number, refinalize: boolean) => {
    setBusy(week);
    await run(() => finalizeWeek(week, refinalize));
    setBusy(null);
  };

  const change = async (week: number, rule: Partial<WeekSettings>) => {
    setEdits({ base: ledger, rules: { ...pending, [week]: { ...pending[week], ...rule } } });
    if (!(await run(() => setWeekRules(week, rule)))) return;
    if (!stored.get(week)?.finalizedAt) return;
    const now = await confirm(
      `Re-finalize week ${week}?`,
      `Week ${week} is already finalized, so the new rules apply only after a re-finalize. That voids its computed ices and recomputes them from Sleeper as of now.`,
      "Re-finalize",
      "Later",
    );
    if (now) await finalize(week, true);
  };

  const refinalize = async (week: number) => {
    const ok = await confirm(
      `Re-finalize week ${week}?`,
      `This voids week ${week}'s computed ices and recomputes them from Sleeper as of now. Admin and late ices stay.`,
      "Re-finalize",
    );
    if (ok) await finalize(week, true);
  };

  return (
    <div className="grid gap-2">
      <p className="xp-note">
        Rules apply when a week finalizes. Ice rules default to off from week 15. Lowest score comes from all
        teams, or only the teams that played a matchup that week.
      </p>
      <div className="xp-table-scroll">
        <table className="xp-table cp-rules" aria-label="Week rules">
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Ice rules</th>
              <th scope="col">Lowest from</th>
              <th scope="col">
                <span className="sr-only">Finalize</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {WEEKS.map((week) => {
              const rules = rulesFor(week);
              const finalizedAt = stored.get(week)?.finalizedAt;
              return (
                <tr key={week}>
                  <th scope="row">
                    Week {week}
                    <span className="cp-sub">{finalizedAt ? `Finalized ${day(finalizedAt)}` : "Not finalized"}</span>
                  </th>
                  <td>
                    <label className="cp-check">
                      <input
                        type="checkbox"
                        aria-label={`Week ${week} ice rules active`}
                        checked={rules.iceRulesActive}
                        onChange={(e) => void change(week, { iceRulesActive: e.target.checked })}
                      />
                      <span aria-hidden>{rules.iceRulesActive ? "On" : "Off"}</span>
                    </label>
                  </td>
                  <td>
                    <select
                      className="xp-select"
                      aria-label={`Week ${week} lowest score scope`}
                      value={rules.lowestScope}
                      onChange={(e) => void change(week, { lowestScope: e.target.value as WeekSettings["lowestScope"] })}
                    >
                      <option value="all">All</option>
                      <option value="played">Played</option>
                    </select>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="xp-button"
                      aria-label={`${finalizedAt ? "Re-finalize" : "Finalize"} week ${week}`}
                      disabled={busy === week}
                      onClick={() => void (finalizedAt ? refinalize(week) : finalize(week, false))}
                    >
                      {busy === week ? "Working..." : finalizedAt ? "Re-finalize" : "Finalize"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
