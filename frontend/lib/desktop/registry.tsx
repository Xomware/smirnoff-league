import type { ComponentType, SVGProps } from "react";

import { IceStandingsView } from "@/components/views/ice-standings-view";
import { PlayerView } from "@/components/views/player-view";
import { StatsView } from "@/components/views/stats-view";
import { TeamView } from "@/components/views/team-view";
import { WeekView } from "@/components/views/week-view";
import { BracketsWindow } from "@/components/windows/BracketsWindow";
import { HomeWindow } from "@/components/windows/HomeWindow";
import { IcesWindow } from "@/components/windows/IcesWindow";
import { NewsWindow } from "@/components/windows/NewsWindow";
import { RecapWindow } from "@/components/windows/RecapWindow";
import { ScoresWindow } from "@/components/windows/ScoresWindow";
import { StandingsWindow } from "@/components/windows/StandingsWindow";
import {
  BracketIcon,
  ChartIcon,
  IceBottleIcon,
  IceCubeIcon,
  IceStandingsIcon,
  InfoIcon,
  MediaPlayerIcon,
  ProfileIcon,
  ScoresIcon,
  StandingsIcon,
} from "@/components/xp/icons";
import { useLeague } from "@/lib/league/use-league";
import type { WindowParams, WindowState } from "./windows";

export type League = Pick<ReturnType<typeof useLeague>, "data" | "teamFor">;

export interface WindowSpec {
  title: string | ((params: WindowParams, league: League) => string);
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  component: ComponentType<{ params: WindowParams }>;
  defaultSize: { w: number; h: number };
}

interface ParamsProps {
  params: WindowParams;
}

function TeamWindow({ params }: ParamsProps) {
  return <TeamView rosterId={Number(params.rosterId)} />;
}

function PlayerWindow({ params }: ParamsProps) {
  return <PlayerView playerId={String(params.playerId)} />;
}

function WeekWindow({ params }: ParamsProps) {
  return <WeekView week={Number(params.week)} />;
}

// One entry per window kind.
const SPECS = {
  home: { title: "Smirnoff Fantasy Football League", Icon: IceBottleIcon, component: HomeWindow, defaultSize: { w: 640, h: 240 } },
  recap: { title: "Now Playing - Draft Recap", Icon: MediaPlayerIcon, component: RecapWindow, defaultSize: { w: 640, h: 420 } },
  news: { title: "League News", Icon: InfoIcon, component: NewsWindow, defaultSize: { w: 380, h: 180 } },
  scores: { title: "Scores", Icon: ScoresIcon, component: ScoresWindow, defaultSize: { w: 560, h: 560 } },
  standings: { title: "League Standings", Icon: StandingsIcon, component: StandingsWindow, defaultSize: { w: 520, h: 520 } },
  brackets: { title: "Brackets", Icon: BracketIcon, component: BracketsWindow, defaultSize: { w: 760, h: 560 } },
  ices: { title: "Ice Ledger", Icon: IceCubeIcon, component: IcesWindow, defaultSize: { w: 520, h: 560 } },
  stats: { title: "Ice Stats", Icon: ChartIcon, component: StatsView, defaultSize: { w: 900, h: 620 } },
  "ice-standings": { title: "Ice Standings", Icon: IceStandingsIcon, component: IceStandingsView, defaultSize: { w: 720, h: 640 } },
  team: {
    title: (p, { data, teamFor }) => (data ? `Team Profile - ${teamFor(Number(p.rosterId)).name}` : "Team Profile"),
    Icon: ProfileIcon,
    component: TeamWindow,
    defaultSize: { w: 600, h: 600 },
  },
  player: {
    title: (p, { data }) => data?.players[String(p.playerId)]?.name ?? "Player Card",
    Icon: ProfileIcon,
    component: PlayerWindow,
    defaultSize: { w: 520, h: 520 },
  },
  week: { title: (p) => `Week ${p.week}`, Icon: ScoresIcon, component: WeekWindow, defaultSize: { w: 600, h: 600 } },
} satisfies Record<string, WindowSpec>;

export type WindowKind = keyof typeof SPECS;
export const REGISTRY: Record<WindowKind, WindowSpec> = SPECS;

export function windowTitle({ kind, params }: WindowState, league: League): string {
  const { title } = REGISTRY[kind];
  return typeof title === "string" ? title : title(params, league);
}

// Team and player titles need the league, so the window and its taskbar tab
// both read titles through this hook.
export function useWindowTitle(): (win: WindowState) => string {
  const { data, teamFor } = useLeague();
  return (win) => windowTitle(win, { data, teamFor });
}
