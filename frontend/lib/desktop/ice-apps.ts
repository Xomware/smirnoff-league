import { CamcorderIcon, ChartIcon, ChugRankIcon, IceBottleIcon, IceStandingsIcon, StopwatchIcon } from "@/components/xp/icons";

export const ICES_PATH = "C:\\Smirnoff\\Ices";

// What the Ices folder holds. The desktop folder window, the Start menu's Ices
// submenu and the phone's Ices tab and Start sheet all list these, in this order.
export const ICE_APPS = [
  { kind: "ices", label: "Ice Ledger", Icon: IceBottleIcon },
  { kind: "ice-standings", label: "Ice Standings", Icon: IceStandingsIcon },
  { kind: "chug-rankings", label: "Ice Rankings", Icon: ChugRankIcon },
  { kind: "stats", label: "Ice Stats", Icon: ChartIcon },
  { kind: "watch", label: "Ice Watch", Icon: StopwatchIcon },
  { kind: "videos", label: "Chug Videos", Icon: CamcorderIcon },
] as const;
