"use client";

import { type ComponentType, type SVGProps, useSyncExternalStore } from "react";

import { ADMIN_PANELS, CATEGORIES } from "@/components/admin/ControlPanel";
import { ProfileIcon, ScoresIcon, SpeakerIcon, StarIcon, StopwatchIcon, IceBottleIcon } from "@/components/xp/icons";
import { REGISTRY, type WindowKind } from "@/lib/desktop/registry";
import type { WindowParams, WindowView } from "@/lib/desktop/windows";
import { useDefaultWeek } from "@/lib/league/default-week";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import type { Searchable } from "@/lib/search/fuzzy";
import type { SleeperMatchup } from "@/lib/sleeper/types";
import { isMuted, subscribeMuted } from "@/lib/sound/sound";

export type Group = "Pages" | "Teams" | "Players" | "Games" | "Weeks" | "Actions";
export const GROUPS: Group[] = ["Pages", "Teams", "Players", "Games", "Weeks", "Actions"];

export type Destination = { type: "view" } & WindowView;
export type Target = Destination | { type: "upload" | "time" | "mute" | "signout" };

export interface PaletteItem extends Searchable {
  id: string;
  group: Group;
  hint?: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  target: Target;
}

type Page = { label: string; keywords: string[]; params?: WindowParams };

// Team, player, week and game windows are searched by name in their own
// groups, and My Team is an action, so every other kind needs a name here.
const PAGES: Record<Exclude<WindowKind, "team" | "player" | "week" | "game" | "my-team">, Page> = {
  home: { label: "Home", keywords: ["smirnoff league", "summary", "dashboard"] },
  scores: { label: "Scores", keywords: ["matchups", "games", "scoreboard"] },
  standings: { label: "League Standings", keywords: ["records", "playoff race", "table"] },
  brackets: { label: "Brackets", keywords: ["playoffs", "toilet bowl"] },
  awards: { label: "Weekly Awards", keywords: ["trophies", "top score", "blowout", "ice king"] },
  news: { label: "League News", keywords: ["transactions", "trades", "moves", "feed"] },
  writeup: { label: "News Drop", keywords: ["latest edition", "newspaper", "writeup"] },
  recap: { label: "Draft Recap", keywords: ["draft", "media player"] },
  ices: { label: "Ice Ledger", keywords: ["owed", "ices"] },
  "ice-standings": { label: "Ice Standings", keywords: ["ice table", "most iced"] },
  "chug-rankings": { label: "Ice Rankings", keywords: ["chug rankings", "leaderboard", "fastest chugs"] },
  stats: { label: "Ice Stats", keywords: ["charts", "hall of shame", "heat check"] },
  watch: { label: "Ice Watch", keywords: ["live"] },
  videos: { label: "Chug Videos", keywords: ["camcorder", "clips"] },
  folder: { label: "Ices Folder", keywords: ["ice apps"], params: { id: "ices" } },
  notifications: { label: "Notifications", keywords: ["alerts", "bell"] },
  admin: { label: "Control Panel", keywords: ["admin", "settings"] },
};

const SoundOn = (props: SVGProps<SVGSVGElement>) => <SpeakerIcon muted={false} {...props} />;
const SoundOff = (props: SVGProps<SVGSVGElement>) => <SpeakerIcon muted {...props} />;

const view = (kind: WindowKind, params: WindowParams = {}): Target => ({ type: "view", kind, params });

export function usePaletteItems(): PaletteItem[] {
  const { data, teamFor } = useLeague();
  const { me } = useProfile();
  const week = useDefaultWeek();
  const thisWeek = useLeague(week).matchups;
  const lastWeek = useLeague(week && week > 1 ? week - 1 : undefined).matchups;
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  const admin = me?.isAdmin ?? false;

  const pages = Object.entries(PAGES).flatMap(([kind, { label, keywords, params }]): PaletteItem[] => {
    const k = kind as WindowKind;
    if (k === "admin" && !admin) return [];
    return [{ id: `page:${k}`, group: "Pages", label, keywords, Icon: REGISTRY[k].Icon, target: view(k, params) }];
  });

  const actions: PaletteItem[] = [
    { id: "action:upload", group: "Actions", label: "Upload chug", keywords: ["chug video", "pay ice"], Icon: IceBottleIcon, target: { type: "upload" } },
    { id: "action:time", group: "Actions", label: "Add chug time", keywords: ["seconds", "stopwatch"], Icon: StopwatchIcon, target: { type: "time" } },
    { id: "action:my-team", group: "Actions", label: "My Team", keywords: ["my ices", "my results"], Icon: StarIcon, target: view("my-team") },
    {
      id: "action:mute",
      group: "Actions",
      label: muted ? "Unmute sounds" : "Mute sounds",
      keywords: ["sound", "volume", "speaker"],
      Icon: muted ? SoundOff : SoundOn,
      target: { type: "mute" },
    },
    { id: "action:signout", group: "Actions", label: "Sign out", keywords: ["log off", "logout"], Icon: ProfileIcon, target: { type: "signout" } },
    ...(admin
      ? ADMIN_PANELS.map((panel): PaletteItem => {
          const { label, Icon } = CATEGORIES[panel];
          return { id: `admin:${panel}`, group: "Actions", label: `Control Panel: ${label}`, Icon, target: view("admin", { panel }) };
        })
      : []),
  ];
  if (!data) return [...pages, ...actions];

  const owner = new Map<string, number>();
  for (const r of data.rosters) for (const p of r.players ?? []) owner.set(p, r.roster_id);
  const games: PaletteItem[] = [];
  for (const [w, rows] of [
    [week, thisWeek],
    [week && week - 1, lastWeek],
  ] as [number | undefined, SleeperMatchup[] | null][]) {
    if (!w || !rows) continue;
    const byGame = new Map<number, SleeperMatchup[]>();
    for (const m of rows) {
      // Rosters carry every rostered player; starters only fill in a player dropped since.
      for (const p of m.starters ?? []) if (p !== "0" && !owner.has(p)) owner.set(p, m.roster_id);
      if (m.matchup_id !== null) byGame.set(m.matchup_id, [...(byGame.get(m.matchup_id) ?? []), m]);
    }
    for (const [matchup, sides] of [...byGame].sort(([a], [b]) => a - b)) {
      const [a, b] = sides.map((s) => teamFor(s.roster_id).name);
      games.push({ id: `game:${w}:${matchup}`, group: "Games", label: `Week ${w}: ${a} vs ${b}`, Icon: ScoresIcon, target: view("game", { week: w, matchup }) });
    }
  }

  const teams = data.rosters.map((r): PaletteItem => {
    const { name, record } = teamFor(r.roster_id);
    const user = data.users.find((u) => u.user_id === r.owner_id);
    return {
      id: `team:${r.roster_id}`,
      group: "Teams",
      label: name,
      keywords: user ? [user.display_name] : [],
      hint: `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""}`,
      Icon: ProfileIcon,
      target: view("team", { rosterId: r.roster_id }),
    };
  });

  const players = [...owner].flatMap(([id, rosterId]): PaletteItem[] => {
    const p = data.players[id];
    if (!p) return [];
    const hint = `${p.position}, ${teamFor(rosterId).name}`;
    return [{ id: `player:${id}`, group: "Players", label: p.name, hint, Icon: ProfileIcon, target: view("player", { playerId: id }) }];
  });

  const latest = Math.min(18, Math.max(1, data.nfl.week));
  const weeks = Array.from({ length: latest }, (_, i): PaletteItem => ({
    id: `week:${latest - i}`,
    group: "Weeks",
    label: `Week ${latest - i}`,
    keywords: ["scores"],
    Icon: ScoresIcon,
    target: view("week", { week: latest - i }),
  }));

  return [...pages, ...teams, ...players, ...games, ...weeks, ...actions];
}
