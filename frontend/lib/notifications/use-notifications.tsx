"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAlerts } from "@/lib/alerts/alerts";
import { useLedger } from "@/lib/ices/use-ledger";
import { leagueTransactions } from "@/lib/league/cache";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import type { SleeperTransaction } from "@/lib/sleeper/types";
import { useVideos } from "@/lib/videos/use-videos";
import { useWriteups } from "@/lib/writeups/use-writeups";
import { deriveNotifications, type Notification, unreadCount } from "./derive";

interface NotificationsState {
  items: Notification[];
  ready: boolean;
  /** True when a source failed to load and its items are missing. */
  partial: boolean;
  unread: number;
  seenAt: string | null;
  markAllSeen: () => Promise<void>;
}

// Outside the provider (a page's own test) there is nothing to notify about.
const NotificationsContext = createContext<NotificationsState>({
  items: [],
  ready: false,
  partial: false,
  unread: 0,
  seenAt: null,
  markAllSeen: async () => {},
});

const NONE: SleeperTransaction[] = [];
const NONE_YET: Notification[] = [];
const BALLOON_KEY = "smirnoff:notifications-balloon";
// The "ice due" item appears at Friday midnight, so a tab left open must notice.
const TICK_MS = 60_000;

function firstBalloonThisSession(): boolean {
  try {
    if (window.sessionStorage.getItem(BALLOON_KEY)) return false;
    window.sessionStorage.setItem(BALLOON_KEY, "1");
  } catch {
    // Storage blocked: the provider's ref still limits it to one per page load.
  }
  return true;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { me, myRosterId, markNotificationsSeen } = useProfile();
  const { data, error: leagueError, teamFor } = useLeague();
  const ledger = useLedger();
  const writeups = useWriteups().state;
  const videos = useVideos().state;
  const { notify } = useAlerts();
  const [txs, setTxs] = useState<SleeperTransaction[] | null>(null);
  const [txError, setTxError] = useState(false);
  const [now, setNow] = useState(Date.now);
  const ballooned = useRef(false);
  const week = data ? Math.max(1, data.nfl.week) : undefined;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (week === undefined) return;
    let live = true;
    const weeks = Array.from({ length: week }, (_, i) => i + 1);
    Promise.all(weeks.map((w) => leagueTransactions(w, w >= week))).then(
      (all) => live && setTxs(all.flat()),
      () => live && setTxError(true),
    );
    return () => {
      live = false;
    };
  }, [week]);

  const transactions = txs ?? (leagueError || txError ? NONE : null);
  const sources = [ledger, writeups, videos];
  const ready = myRosterId !== null && transactions !== null && sources.every((s) => s.status !== "loading");
  const partial = !!leagueError || txError || sources.some((s) => s.status === "error");

  const items = useMemo(() => {
    if (!ready || myRosterId === null || transactions === null) return NONE_YET;
    return deriveNotifications({
      myRosterId,
      ledger: ledger.status === "ok" ? ledger.ledger : null,
      writeups: writeups.status === "ok" ? writeups.writeups : [],
      videos: videos.status === "ok" ? videos.videos : [],
      transactions,
      teamName: (r) => teamFor(r).name,
      now,
    });
  }, [ready, myRosterId, ledger, writeups, videos, transactions, teamFor, now]);

  const seenAt = me?.profile?.notificationsSeenAt ?? null;
  const unread = unreadCount(items, seenAt);

  useEffect(() => {
    if (!ready || !unread || ballooned.current) return;
    ballooned.current = true;
    if (!firstBalloonThisSession()) return;
    notify({
      title: unread === 1 ? "1 new notification" : `${unread} new notifications`,
      body: `${items[0].title}. ${items[0].body}.`,
      icon: "info",
    });
  }, [ready, unread, items, notify]);

  const markAllSeen = useCallback(() => markNotificationsSeen(new Date().toISOString()), [markNotificationsSeen]);

  return (
    <NotificationsContext value={{ items, ready, partial, unread, seenAt, markAllSeen }}>{children}</NotificationsContext>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
