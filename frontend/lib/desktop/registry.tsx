import type { ComponentType, SVGProps } from "react";

import { ControlPanelWindow } from "@/components/admin/ControlPanel";
import { IceStandingsView } from "@/components/views/ice-standings-view";
import { MyTeamView } from "@/components/views/my-team-view";
import { PlayerView } from "@/components/views/player-view";
import { StatsView } from "@/components/views/stats-view";
import { TeamView } from "@/components/views/team-view";
import { WeekView } from "@/components/views/week-view";
import { BracketsWindow } from "@/components/windows/BracketsWindow";
import { FolderWindow } from "@/components/windows/FolderWindow";
import { HomeWindow } from "@/components/windows/HomeWindow";
import { IcesWindow } from "@/components/windows/IcesWindow";
import { NewsWindow } from "@/components/windows/NewsWindow";
import { NotificationsWindow } from "@/components/windows/NotificationsWindow";
import { RecapWindow } from "@/components/windows/RecapWindow";
import { ScoresWindow } from "@/components/windows/ScoresWindow";
import { StandingsWindow } from "@/components/windows/StandingsWindow";
import { VideosWindow } from "@/components/windows/VideosWindow";
import { WatchWindow } from "@/components/windows/WatchWindow";
import { WriteupWindow } from "@/components/windows/WriteupWindow";
import {
  BellIcon,
  BracketIcon,
  CamcorderIcon,
  ChartIcon,
  ControlPanelIcon,
  FolderIcon,
  IceBottleIcon,
  IceStandingsIcon,
  MediaPlayerIcon,
  NewsFeedIcon,
  NewspaperIcon,
  ProfileIcon,
  RobotHeadIcon,
  ScoresIcon,
  StandingsIcon,
  StarIcon,
  StopwatchIcon,
} from "@/components/xp/icons";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { HOME_H, type WindowParams, type WindowView } from "./windows";

export type League = Pick<ReturnType<typeof useLeague>, "data" | "teamFor"> & { myRosterId?: number | null };

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
  home: { title: "Smirnoff Fantasy Football League", Icon: RobotHeadIcon, component: HomeWindow, defaultSize: { w: 640, h: HOME_H } },
  recap: { title: "Now Playing - Draft Recap", Icon: MediaPlayerIcon, component: RecapWindow, defaultSize: { w: 640, h: 420 } },
  news: { title: "League News", Icon: NewsFeedIcon, component: NewsWindow, defaultSize: { w: 600, h: 600 } },
  scores: { title: "Scores", Icon: ScoresIcon, component: ScoresWindow, defaultSize: { w: 560, h: 560 } },
  standings: { title: "League Standings", Icon: StandingsIcon, component: StandingsWindow, defaultSize: { w: 520, h: 520 } },
  brackets: { title: "Brackets", Icon: BracketIcon, component: BracketsWindow, defaultSize: { w: 760, h: 560 } },
  ices: { title: "Ice Ledger", Icon: IceBottleIcon, component: IcesWindow, defaultSize: { w: 520, h: 560 } },
  watch: { title: "Ice Watch", Icon: StopwatchIcon, component: WatchWindow, defaultSize: { w: 560, h: 600 } },
  stats: { title: "Ice Stats", Icon: ChartIcon, component: StatsView, defaultSize: { w: 900, h: 620 } },
  "ice-standings": { title: "Ice Standings", Icon: IceStandingsIcon, component: IceStandingsView, defaultSize: { w: 720, h: 640 } },
  // Only the Ices folder exists; its id is what a `folder:ices` link names.
  folder: { title: "Ices", Icon: FolderIcon, component: FolderWindow, defaultSize: { w: 720, h: 560 } },
  notifications: { title: "Notifications", Icon: BellIcon, component: NotificationsWindow, defaultSize: { w: 440, h: 520 } },
  videos: { title: "Chug Videos", Icon: CamcorderIcon, component: VideosWindow, defaultSize: { w: 720, h: 640 } },
  team: {
    title: (p, { data, teamFor }) => (data ? `Team Profile - ${teamFor(Number(p.rosterId)).name}` : "Team Profile"),
    Icon: ProfileIcon,
    component: TeamWindow,
    defaultSize: { w: 720, h: 640 },
  },
  "my-team": {
    title: (_, { data, teamFor, myRosterId }) => (data && myRosterId ? `My Team - ${teamFor(myRosterId).name}` : "My Team"),
    Icon: StarIcon,
    component: MyTeamView,
    defaultSize: { w: 720, h: 640 },
  },
  player: {
    title: (p, { data }) => data?.players[String(p.playerId)]?.name ?? "Player Card",
    Icon: ProfileIcon,
    component: PlayerWindow,
    defaultSize: { w: 520, h: 520 },
  },
  week: { title: (p) => `Week ${p.week}`, Icon: ScoresIcon, component: WeekWindow, defaultSize: { w: 600, h: 600 } },
  writeup: {
    title: (p) => (p.week ? `Smirnoff League - Week ${p.week} Edition` : "Smirnoff League - Latest Edition"),
    Icon: NewspaperIcon,
    component: WriteupWindow,
    defaultSize: { w: 760, h: 720 },
  },
  admin: { title: "Control Panel", Icon: ControlPanelIcon, component: ControlPanelWindow, defaultSize: { w: 820, h: 620 } },
} satisfies Record<string, WindowSpec>;

export type WindowKind = keyof typeof SPECS;
export const REGISTRY: Record<WindowKind, WindowSpec> = SPECS;

export function windowTitle({ kind, params }: WindowView, league: League): string {
  const { title } = REGISTRY[kind];
  return typeof title === "string" ? title : title(params, league);
}

// Team and player titles need the league, so windows, taskbar tabs and phone
// screens all read titles through this hook.
export function useWindowTitle(): (view: WindowView) => string {
  const { data, teamFor } = useLeague();
  const { myRosterId } = useProfile();
  return (view) => windowTitle(view, { data, teamFor, myRosterId });
}
