import type { ComponentType, SVGProps } from "react";

import { BracketsWindow } from "@/components/windows/BracketsWindow";
import { HomeWindow } from "@/components/windows/HomeWindow";
import { IcesWindow } from "@/components/windows/IcesWindow";
import { NewsWindow } from "@/components/windows/NewsWindow";
import { RecapWindow } from "@/components/windows/RecapWindow";
import { ScoresWindow } from "@/components/windows/ScoresWindow";
import { StandingsWindow } from "@/components/windows/StandingsWindow";
import {
  BracketIcon,
  IceBottleIcon,
  IceCubeIcon,
  InfoIcon,
  MediaPlayerIcon,
  ScoresIcon,
  StandingsIcon,
} from "@/components/xp/icons";
import type { WindowParams } from "./windows";

export interface WindowSpec {
  title: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  component: ComponentType<{ params: WindowParams }>;
  defaultSize: { w: number; h: number };
}

// One entry per window kind. Later kinds (team, player, week, stats) append here.
export const REGISTRY = {
  home: { title: "Smirnoff Fantasy Football League", Icon: IceBottleIcon, component: HomeWindow, defaultSize: { w: 640, h: 240 } },
  recap: { title: "Now Playing - Draft Recap", Icon: MediaPlayerIcon, component: RecapWindow, defaultSize: { w: 640, h: 420 } },
  news: { title: "League News", Icon: InfoIcon, component: NewsWindow, defaultSize: { w: 380, h: 180 } },
  scores: { title: "Scores", Icon: ScoresIcon, component: ScoresWindow, defaultSize: { w: 560, h: 560 } },
  standings: { title: "League Standings", Icon: StandingsIcon, component: StandingsWindow, defaultSize: { w: 520, h: 520 } },
  brackets: { title: "Brackets", Icon: BracketIcon, component: BracketsWindow, defaultSize: { w: 760, h: 560 } },
  ices: { title: "Ice Ledger", Icon: IceCubeIcon, component: IcesWindow, defaultSize: { w: 520, h: 560 } },
} satisfies Record<string, WindowSpec>;

export type WindowKind = keyof typeof REGISTRY;
