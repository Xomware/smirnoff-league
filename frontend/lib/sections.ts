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

// How Glacier and the phone Menu organize every page the XP desktop can open.
// A kind may sit in two sections; it opens in the first unless the current
// section also lists it.
export const SECTIONS: Section[] = [
  { id: "home", label: "Home", pages: [{ label: "Home", kind: "home" }] },
  {
    id: "games",
    label: "Games",
    pages: [
      { label: "This week", kind: "watch" },
      { label: "Scores", kind: "scores" },
      { label: "Week view", kind: "week" },
      { label: "Brackets", kind: "brackets" },
    ],
    drills: ["game"],
  },
  {
    id: "ices",
    label: "Ices",
    pages: [
      { label: "Overview", kind: "ices-overview" },
      { label: "Ledger", kind: "ices" },
      { label: "Ice standings", kind: "ice-standings" },
      { label: "Rankings", kind: "chug-rankings" },
      { label: "Stats", kind: "stats" },
      { label: "Chug videos", kind: "videos" },
    ],
    // The XP Ices folder only lists the pages above.
    drills: ["folder"],
  },
  {
    id: "league",
    label: "League",
    pages: [
      { label: "Standings", kind: "standings" },
      { label: "Teams", kind: "teams" },
      { label: "Brackets", kind: "brackets" },
      { label: "Awards", kind: "awards" },
      { label: "Draft recap", kind: "recap" },
      { label: "News", kind: "news" },
    ],
    drills: ["team", "player"],
  },
  {
    id: "news-drop",
    label: "News Drop",
    pages: [
      { label: "Latest edition", kind: "writeup" },
      { label: "League news", kind: "news" },
    ],
  },
  {
    id: "account",
    label: "Account",
    account: true,
    pages: [
      { label: "My Profile", kind: "profile" },
      { label: "Settings", kind: "settings" },
      { label: "My Team", kind: "my-team" },
      { label: "Notifications", kind: "notifications" },
      { label: "Control Panel", kind: "admin", admin: true },
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
