"use client";

import { type ComponentType, type SVGProps, useState } from "react";

import { IceBottleIcon, NewspaperIcon, RosterMoveIcon, StopwatchIcon, TradeIcon } from "@/components/xp/icons";
import type { Player, Team } from "@/lib/league/use-league";
import { type NewsItem, type Part, timeAgo } from "@/lib/news/feed";
import { DrillLink } from "./drill-link";
import "./news.css";

const ICONS: Record<NewsItem["event"], ComponentType<SVGProps<SVGSVGElement>>> = {
  move: RosterMoveIcon,
  trade: TradeIcon,
  ice: IceBottleIcon,
  paid: StopwatchIcon,
  writeup: NewspaperIcon,
};

// "Darren Waller" -> "D. Waller"; a defense keeps its full team name.
const shortName = (p: Player) => (p.position === "DEF" ? p.name : p.name.replace(/^(\S)\S*\s+/, "$1. "));

interface NewsListProps {
  label: string;
  items: NewsItem[];
  players: Record<string, Player>;
  teamFor: (rosterId: number) => Team;
}

export function NewsList({ label, items, players, teamFor }: NewsListProps) {
  const [now] = useState(Date.now);

  const part = (p: Part, i: number) => {
    if (typeof p === "string") return p;
    if ("rosterId" in p) {
      return (
        <DrillLink key={i} to={{ kind: "team", rosterId: p.rosterId }}>
          <b>{teamFor(p.rosterId).name}</b>
        </DrillLink>
      );
    }
    const player = players[p.playerId];
    return (
      <DrillLink key={i} to={{ kind: "player", playerId: p.playerId }}>
        <span title={player?.name}>{player ? shortName(player) : p.playerId}</span>
      </DrillLink>
    );
  };

  return (
    <ol aria-label={label} className="news-list">
      {items.map((item) => {
        const Icon = ICONS[item.event];
        return (
          <li key={item.id} className={`news-row news-${item.event}`}>
            <Icon width={20} height={20} className="news-icon" />
            <p className="news-headline">{item.headline.map(part)}</p>
            <span className="news-meta">
              <span className="xp-watch-tag">W{item.week}</span>
              <time dateTime={new Date(item.at).toISOString()}>{timeAgo(item.at, now)}</time>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
