import type { WindowKind } from "@/lib/desktop/registry";
import type { ActivityKind } from "./tracker";

export interface Names {
  team: (rosterId: number) => string;
  player: (playerId: string) => string | undefined;
}

// Short names for the timeline; several registry titles are window-bar length.
const PLACES: Partial<Record<WindowKind, string>> = {
  home: "Home",
  recap: "Draft Recap",
  news: "League News",
  scores: "Scores",
  standings: "League Standings",
  brackets: "Brackets",
  ices: "Ice Ledger",
  watch: "Ice Watch",
  stats: "Ice Stats",
  "ice-standings": "Ice Standings",
  folder: "Ices folder",
  notifications: "Notifications",
  videos: "Chug Videos",
  "my-team": "My Team",
  writeup: "Latest Edition",
  admin: "Control Panel",
};

const PANELS: Record<string, string> = { ices: "Ices", rules: "Week Rules", toilet: "Toilet Bowl", users: "Users" };

function place(target: string, names: Names): string {
  const [kind, value] = target.split(":");
  if (value === undefined) return PLACES[kind as WindowKind] ?? target;
  switch (kind) {
    case "team":
      return `Team: ${names.team(Number(value))}`;
    case "player":
      return `Player: ${names.player(value) ?? value}`;
    case "week":
      return `Week ${value}`;
    case "writeup":
      return `Week ${value} Edition`;
    case "admin":
      return `Control Panel: ${PANELS[value] ?? value}`;
    default:
      return PLACES[kind as WindowKind] ?? target;
  }
}

export function describeActivity(kind: ActivityKind, target: string, names: Names): string {
  const edition = target.startsWith("edition:") ? `the Week ${target.slice(8)} edition` : "an edition";
  switch (kind) {
    case "signin":
      return "Signed in";
    case "open":
      return `Opened ${place(target, names)}`;
    case "drill":
      return `Went to ${place(target, names)}`;
    case "upload":
      return target.startsWith("chug") ? "Uploaded a chug" : `Uploaded ${edition}`;
    case "publish":
      return `Published ${edition}`;
  }
}
