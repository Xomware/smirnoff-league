import type { WindowKind } from "@/lib/desktop/registry";
import type { WindowParams } from "@/lib/desktop/windows";

// The registry's kinds plus the pages Glacier and the phone render themselves.
export type PageKind = WindowKind | "teams" | "profile" | "settings";

export interface PageView {
  kind: PageKind;
  params: WindowParams;
}

export interface SubPage {
  label: string;
  // The phone's sub-tab grid is three across, so a long label gets a short one.
  short?: string;
  // One line under the page's title saying what is on it.
  description: string;
  kind: PageKind;
  admin?: true;
}

export interface Section {
  id: string;
  label: string;
  pages: SubPage[];
  // Kinds reached by drilling in from a page rather than from the sub-nav.
  drills?: PageKind[];
  // Opens from the account menu rather than the main nav.
  account?: true;
}

const BRACKETS = "Playoff and toilet bowl brackets, filled in as each round finishes.";
const NEWS = "Trades, waiver claims and drops across the league, newest first.";

// How Glacier and the phone Menu organize every page the XP desktop can open.
// A kind may sit in two sections; it opens in the first unless the current
// section also lists it.
export const SECTIONS: Section[] = [
  { id: "home", label: "Home", pages: [{ label: "Home", description: "This week at a glance: your ices, the games and the latest chugs.", kind: "home" }] },
  {
    id: "games",
    label: "Games",
    pages: [
      { label: "This week", description: "Every starter in danger of an ice, checked while games are live.", kind: "watch" },
      { label: "Scores", description: "Each matchup's score, one week at a time.", kind: "scores" },
      { label: "Week view", short: "Week", description: "One week's games, its lowest score and the ices it produced.", kind: "week" },
      { label: "Brackets", description: BRACKETS, kind: "brackets" },
    ],
    drills: ["game"],
  },
  {
    id: "ices",
    label: "Ices",
    pages: [
      { label: "Overview", description: "Who owes, who leads and who is running hot, on one page.", kind: "ices-overview" },
      { label: "Ledger", description: "Who owes what and when, week by week.", kind: "ices" },
      { label: "Ice standings", short: "Standings", description: "Teams ranked by ices, for the season or a single week.", kind: "ice-standings" },
      { label: "Rankings", description: "Chug times ranked by personal best.", kind: "chug-rankings" },
      { label: "Stats", description: "Trends: who ices, when, and at which positions.", kind: "stats" },
      { label: "Chug videos", short: "Videos", description: "Every chug on tape, newest first. Tap one to play it.", kind: "videos" },
    ],
    // The XP Ices folder only lists the pages above.
    drills: ["folder"],
  },
  {
    id: "league",
    label: "League",
    pages: [
      { label: "Standings", description: "Records and points for, with the playoff line drawn in.", kind: "standings" },
      { label: "Teams", description: "All 14 teams. Tap one for its results, ices and moves.", kind: "teams" },
      { label: "Brackets", description: BRACKETS, kind: "brackets" },
      { label: "Awards", description: "Each week's top score, biggest blowout and Ice King.", kind: "awards" },
      { label: "Draft recap", short: "Recap", description: "The draft recap video, start to finish.", kind: "recap" },
      { label: "News", description: NEWS, kind: "news" },
    ],
    drills: ["team", "player"],
  },
  {
    id: "news-drop",
    label: "News Drop",
    pages: [
      { label: "Latest edition", short: "Latest", description: "The newest edition of the league paper, with past issues a tap away.", kind: "writeup" },
      { label: "League news", short: "News", description: NEWS, kind: "news" },
    ],
  },
  {
    id: "account",
    label: "Account",
    account: true,
    pages: [
      { label: "My Profile", description: "Your name, username and the team you manage.", kind: "profile" },
      { label: "Settings", description: "Email alerts, theme, sounds and the ticker.", kind: "settings" },
      { label: "My Team", description: "Your team's results, ices, moves and lineup.", kind: "my-team" },
      { label: "Notifications", description: "Your ices and deadlines, new chugs, comments and editions.", kind: "notifications" },
      { label: "Control Panel", description: "Commissioner tools: ices, week rules, the toilet bowl and users.", kind: "admin", admin: true },
    ],
  },
];

export const pagesFor = (section: Section, isAdmin: boolean) => section.pages.filter((p) => isAdmin || !p.admin);

// Week view opens on the current week, like the desktop's Scores.
export const pageView = ({ kind }: SubPage, week: number | undefined): PageView => ({
  kind,
  params: kind === "week" ? { week: week ?? 1 } : {},
});

const lists = (s: Section, kind: PageKind) => s.pages.some((p) => p.kind === kind) || Boolean(s.drills?.includes(kind));

// A player card opens from lineups everywhere, so it keeps the section it was opened from.
export function sectionOf(kind: PageKind, from?: Section): Section {
  if (from && (kind === "player" || lists(from, kind))) return from;
  return SECTIONS.find((s) => lists(s, kind)) ?? SECTIONS[0];
}

export const descriptionOf = (kind: string) => SECTIONS.flatMap((s) => s.pages).find((p) => p.kind === kind)?.description;
