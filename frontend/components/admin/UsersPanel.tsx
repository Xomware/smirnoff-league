"use client";

import { useCallback, useEffect, useState } from "react";

import { describeActivity } from "@/lib/activity/describe";
import { type ActivityRow, type AdminUser, listActivity, listUsers } from "@/lib/api/admin";
import { useNow } from "@/lib/ices/use-now";
import { useLeague } from "@/lib/league/use-league";
import { timeAgo } from "@/lib/news/feed";

type Load<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; value: T };

function useLoad<T>(fetcher: () => Promise<T>): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  useEffect(() => {
    let live = true;
    fetcher()
      .then((value) => live && setState({ status: "ok", value }))
      .catch((e: Error) => live && setState({ status: "error", message: e.message }));
    return () => {
      live = false;
    };
  }, [fetcher]);
  return state;
}

type SortKey = "name" | "team" | "seen" | "signIns" | "device" | "alerts" | "joined";
interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

const COLUMNS: { key: SortKey; label: string; firstDir: Sort["dir"] }[] = [
  { key: "name", label: "User", firstDir: "asc" },
  { key: "team", label: "Team", firstDir: "asc" },
  { key: "seen", label: "Last seen", firstDir: "desc" },
  { key: "signIns", label: "Sign-ins", firstDir: "desc" },
  { key: "device", label: "Device", firstDir: "asc" },
  { key: "alerts", label: "Email alerts", firstDir: "desc" },
  { key: "joined", label: "Joined", firstDir: "desc" },
];

const LEAGUE_TZ = "America/New_York";
const joinedDate = (at: string) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: LEAGUE_TZ });
const eventTime = (at: string) =>
  new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: LEAGUE_TZ });

function Timeline({ user, onBack }: { user: AdminUser; onBack: () => void }) {
  const state = useLoad(useCallback(() => listActivity(user.sub), [user.sub]));
  const { data, teamFor } = useLeague();
  const names = { team: (id: number) => teamFor(id).name, player: (id: string) => data?.players[id]?.name };
  const now = useNow([]);

  return (
    <div className="grid gap-3">
      <div className="cp-inline">
        <button type="button" className="xp-button" onClick={onBack}>
          All users
        </button>
        <h4 className="cp-user-title">
          {user.name} <span className="cp-sub">@{user.username}</span>
        </h4>
      </div>
      {state.status === "loading" && <p role="status">Loading activity...</p>}
      {state.status === "error" && <p role="alert">Could not load activity ({state.message}).</p>}
      {state.status === "ok" && state.value.length === 0 && <p>No activity in the last 90 days.</p>}
      {state.status === "ok" && state.value.length > 0 && (
        <ol className="cp-timeline" aria-label={`Activity for ${user.name}`}>
          {state.value.map((e: ActivityRow, i) => (
            <li key={`${e.at}-${i}`}>
              <span className="cp-event">{describeActivity(e.kind, e.target, names)}</span>
              <span className="cp-sub">
                <time dateTime={e.at}>{eventTime(e.at)}</time> ({timeAgo(Date.parse(e.at), now)}) - {e.ua}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function UsersPanel() {
  const state = useLoad(listUsers);
  const { teamFor } = useLeague();
  const [sort, setSort] = useState<Sort>({ key: "seen", dir: "desc" });
  const [picked, setPicked] = useState<AdminUser | null>(null);
  const now = useNow([]);

  if (picked) return <Timeline user={picked} onBack={() => setPicked(null)} />;
  if (state.status === "loading") return <p role="status">Loading users...</p>;
  if (state.status === "error") return <p role="alert">Could not load users ({state.message}). Close and reopen to try again.</p>;

  const value = (u: AdminUser): string | number => {
    switch (sort.key) {
      case "name":
        return u.name.toLowerCase();
      case "team":
        return teamFor(u.rosterId).name.toLowerCase();
      case "seen":
        return u.lastSeenAt ? Date.parse(u.lastSeenAt) : 0;
      case "signIns":
        return u.signInCount;
      case "device":
        return u.lastUa ?? "";
      case "alerts":
        return Number(u.emailOptIn);
      case "joined":
        return Date.parse(u.createdAt);
    }
  };
  const flip = sort.dir === "asc" ? 1 : -1;
  const rows = [...state.value].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    return (x < y ? -1 : x > y ? 1 : 0) * flip || a.name.localeCompare(b.name);
  });
  const onSort = (key: SortKey, firstDir: Sort["dir"]) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: firstDir }));

  return (
    <div className="xp-table-scroll">
      <table className="xp-table cp-users">
        <caption className="mb-2 text-left text-sm font-bold">League members ({rows.length})</caption>
        <thead>
          <tr>
            {COLUMNS.map(({ key, label, firstDir }) => {
              const active = sort.key === key;
              return (
                <th key={key} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                  <button type="button" className="xp-sort" onClick={() => onSort(key, firstDir)}>
                    {label}
                    <svg viewBox="0 0 8 8" width={8} height={8} aria-hidden focusable="false" className={active ? "" : "invisible"}>
                      <path d={sort.dir === "asc" ? "M4 1l3 5H1z" : "M4 7L1 2h6z"} className="fill-current" />
                    </svg>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.sub}>
              <th scope="row">
                <button type="button" className="xp-drill cp-user" onClick={() => setPicked(u)}>
                  {u.name}
                  <span className="cp-sub">@{u.username}</span>
                </button>
              </th>
              <td data-label="Team">{teamFor(u.rosterId).name}</td>
              <td data-label="Last seen">{u.lastSeenAt ? timeAgo(Date.parse(u.lastSeenAt), now) : "Never"}</td>
              <td data-label="Sign-ins" className="tabular-nums">
                {u.signInCount}
              </td>
              <td data-label="Device">{u.lastUa ?? "Unknown"}</td>
              <td data-label="Email alerts">{u.emailOptIn ? "On" : "Off"}</td>
              <td data-label="Joined">{joinedDate(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
