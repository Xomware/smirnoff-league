"use client";

import { type FormEvent, useEffect, useId, useState } from "react";

import { addIce, type AdminUser, listUsers, setChugTime, setIceCompleted, voidIce } from "@/lib/api/admin";
import type { ChuggerPick, Ledger, LedgerIce } from "@/lib/api/ledger";
import { useLeague } from "@/lib/league/use-league";
import { useAdminAction } from "./use-admin-action";

const WEEKS = Array.from({ length: 17 }, (_, i) => i + 1);
const OTHER = "other";

const mss = (s: number) => {
  const whole = String(Math.floor(s % 60)).padStart(2, "0");
  const frac = s % 1 ? (s % 1).toFixed(2).slice(1) : "";
  return `${Math.floor(s / 60)}:${whole}${frac}`;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function cause(ice: LedgerIce, players: Record<string, { name: string }>): string {
  if (ice.reason === "late") return `Late ice ${ice.iceId.split("#LATE")[1]}`;
  if (ice.reason === "lowest") return "Lowest score";
  if (ice.reason === "empty") return "Empty slot";
  if (ice.reason === "admin") return "Admin ice";
  return `${players[ice.playerId!]?.name ?? ice.playerId} (${ice.slot})`;
}

interface IceRowProps {
  ice: LedgerIce;
  team: string;
  label: string;
  users: AdminUser[];
  onComplete: (at?: string) => void;
  onUndo: () => void;
  onChug: (seconds: number, chugger?: ChuggerPick) => void;
  onVoid: (note: string) => void;
}

function IceRow({ ice, team, label, users, onComplete, onUndo, onChug, onVoid }: IceRowProps) {
  const [at, setAt] = useState("");
  const [seconds, setSeconds] = useState(ice.chugSeconds ? String(ice.chugSeconds) : "");
  // Null until the admin picks, so a user list that arrives late still preselects the chugger on record.
  const [who, setWho] = useState<string | null>(null);
  const [other, setOther] = useState(ice.chugger?.name ?? "");
  const [voiding, setVoiding] = useState(false);
  const [note, setNote] = useState("");
  const hintId = useId();
  const done = ice.status === "completed";
  const typed = Number(seconds);
  const onRecord = users.find((u) => u.name === ice.chugger?.name);
  const pick = who ?? (onRecord ? onRecord.sub : ice.chugger ? OTHER : "");
  const chugger: ChuggerPick | undefined = pick === OTHER ? (other.trim() ? { name: other.trim() } : undefined) : pick ? { sub: pick } : undefined;

  const submit = (e: FormEvent, action: () => void) => {
    e.preventDefault();
    action();
  };

  return (
    <li aria-label={`W${ice.week} ${team} - ${label}`} className={`cp-ice${done ? "" : " cp-ice-owed"}`}>
      <div className="cp-ice-head">
        <span className="xp-player-pos">W{ice.week}</span>
        <span className="font-bold">{team}</span>
        <span>{label}</span>
        <span className="xp-watch-tag ml-auto">{done ? `Completed ${ice.completedAt ? when(ice.completedAt) : ""}` : "Owed"}</span>
      </div>
      {ice.note && <p className="cp-ice-note">Note: {ice.note}</p>}
      <div className="cp-ice-actions">
        {done ? (
          <button type="button" className="xp-button" onClick={onUndo}>
            Undo
          </button>
        ) : (
          <form className="cp-inline" onSubmit={(e) => submit(e, () => onComplete(at ? new Date(at).toISOString() : undefined))}>
            <label className="cp-field">
              Completed at
              <input type="datetime-local" className="xp-input" aria-describedby={hintId} value={at} onChange={(e) => setAt(e.target.value)} />
            </label>
            <span id={hintId} className="sr-only">
              Leave blank for now
            </span>
            <button type="submit" className="xp-button">
              Complete
            </button>
          </form>
        )}
        <form className="cp-inline" onSubmit={(e) => submit(e, () => onChug(typed, chugger))}>
          <label className="cp-field">
            Chug seconds
            <input
              type="number"
              className="xp-input cp-seconds"
              min="0.1"
              max="599.9"
              step="0.1"
              required
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
            />
          </label>
          <output className="cp-mss" aria-label="Chug time">
            {typed > 0 && typed < 600 ? mss(typed) : "-:--"}
          </output>
          <label className="cp-field">
            Chugger
            <select className="xp-select" value={pick} onChange={(e) => setWho(e.target.value)}>
              <option value="">Not named</option>
              {users.map((u) => (
                <option key={u.sub} value={u.sub}>
                  {u.name}
                </option>
              ))}
              <option value={OTHER}>Someone else...</option>
            </select>
          </label>
          {pick === OTHER && (
            <label className="cp-field">
              Chugger name
              <input className="xp-input" required maxLength={40} value={other} onChange={(e) => setOther(e.target.value)} />
            </label>
          )}
          <button type="submit" className="xp-button" aria-label="Save chug time">
            Save
          </button>
        </form>
        {!voiding && (
          <button type="button" className="xp-button cp-danger" onClick={() => setVoiding(true)}>
            Void
          </button>
        )}
      </div>
      {voiding && (
        <form className="cp-inline" onSubmit={(e) => submit(e, () => onVoid(note.trim()))}>
          <label className="cp-field grow">
            Reason for voiding
            <input className="xp-input" required maxLength={200} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="submit" className="xp-button cp-danger">
            Void ice
          </button>
          <button type="button" className="xp-button" onClick={() => setVoiding(false)}>
            Cancel
          </button>
        </form>
      )}
    </li>
  );
}

interface AddIceProps {
  week: number;
  teams: { rosterId: number; name: string }[];
}

function AddIce({ week: latest, teams }: AddIceProps) {
  const { run } = useAdminAction();
  const [week, setWeek] = useState(latest);
  const [rosterId, setRosterId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (await run(() => addIce(week, Number(rosterId), note.trim()))) setNote("");
    setBusy(false);
  };

  return (
    <form aria-label="Add ice" className="xp-group cp-add" onSubmit={(e) => void submit(e)}>
      <h4 className="xp-group-title">Add ice</h4>
      <div className="cp-inline">
        <label className="cp-field">
          Week
          <select className="xp-select" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
            {WEEKS.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </label>
        <label className="cp-field">
          Team
          <select className="xp-select" required value={rosterId} onChange={(e) => setRosterId(e.target.value)}>
            <option value="">Choose a team</option>
            {teams.map((t) => (
              <option key={t.rosterId} value={t.rosterId}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cp-field grow">
          Note
          <input className="xp-input" required maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="submit" className="xp-button" disabled={busy}>
          {busy ? "Adding..." : "Add ice"}
        </button>
      </div>
    </form>
  );
}

const ALL = "all";

export function IcesPanel({ ledger }: { ledger: Ledger }) {
  const { data, teamFor } = useLeague();
  const { run, confirm } = useAdminAction();
  const latest = Math.max(1, ...ledger.ices.map((i) => i.week));
  const [week, setWeek] = useState(String(latest));
  const [team, setTeam] = useState(ALL);
  // Tied to the ledger it was made from, so the refetch replaces it.
  const [optimistic, setOptimistic] = useState<{ base: Ledger; ices: LedgerIce[] } | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);

  // Without the list the picker still takes a typed name.
  useEffect(() => {
    let live = true;
    listUsers().then(
      (list) => live && setUsers([...list].sort((a, b) => a.name.localeCompare(b.name))),
      () => live && setUsers([]),
    );
    return () => {
      live = false;
    };
  }, []);

  if (!data) return <p role="status">Loading teams...</p>;

  const ices = optimistic?.base === ledger ? optimistic.ices : ledger.ices;
  const patch = (iceId: string, change: Partial<LedgerIce> | null) =>
    setOptimistic({
      base: ledger,
      ices: change ? ices.map((i) => (i.iceId === iceId ? { ...i, ...change } : i)) : ices.filter((i) => i.iceId !== iceId),
    });

  const teams = data.rosters
    .map((r) => ({ rosterId: r.roster_id, name: teamFor(r.roster_id).name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const weeks = [...new Set(ledger.ices.map((i) => i.week))].sort((a, b) => a - b);
  const shown = ices
    .filter((i) => (week === ALL || i.week === Number(week)) && (team === ALL || i.rosterId === Number(team)))
    .sort((a, b) => b.week - a.week || a.rosterId - b.rosterId || a.iceId.localeCompare(b.iceId));

  return (
    <div className="grid gap-3">
      <AddIce week={latest} teams={teams} />
      <div className="cp-inline" role="group" aria-label="Filters">
        <label className="cp-field">
          Show
          <select className="xp-select" aria-label="Filter by week" value={week} onChange={(e) => setWeek(e.target.value)}>
            <option value={ALL}>All weeks</option>
            {weeks.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </label>
        <select className="xp-select" aria-label="Filter by team" value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value={ALL}>All teams</option>
          {teams.map((t) => (
            <option key={t.rosterId} value={t.rosterId}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {shown.length === 0 ? (
        <p className="xp-inset p-3">No ices match these filters.</p>
      ) : (
        <ul aria-label="Ices" className="cp-ices">
          {shown.map((ice) => {
            const name = teamFor(ice.rosterId).name;
            const label = cause(ice, data.players);
            const what = `the W${ice.week} ${label.toLowerCase()} ice for ${name}`;
            return (
              <IceRow
                key={ice.iceId}
                ice={ice}
                team={name}
                label={label}
                users={users}
                onComplete={(at) => {
                  patch(ice.iceId, { status: "completed", completedAt: at ?? new Date().toISOString() });
                  void run(() => setIceCompleted(ice.iceId, true, at));
                }}
                onUndo={async () => {
                  if (!(await confirm("Undo completion", `Set ${what} back to owed?`, "Undo"))) return;
                  patch(ice.iceId, { status: "owed", completedAt: null });
                  void run(() => setIceCompleted(ice.iceId, false));
                }}
                onChug={(seconds, chugger) => {
                  const name = chugger && ("name" in chugger ? chugger.name : users.find((u) => u.sub === chugger.sub)?.name);
                  patch(ice.iceId, name ? { chugSeconds: seconds, chugger: { name } } : { chugSeconds: seconds });
                  void run(() => setChugTime(ice.iceId, seconds, chugger));
                }}
                onVoid={async (note) => {
                  if (!(await confirm("Void ice", `Void ${what}? It leaves the ledger and cannot be brought back here.`, "Void"))) return;
                  patch(ice.iceId, null);
                  void run(() => voidIce(ice.iceId, note));
                }}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
