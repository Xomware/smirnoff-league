"use client";

import { type ComponentType, type SVGProps, useEffect, useRef, useState } from "react";

import { DrillLink } from "@/components/views/drill-link";
import { CamcorderIcon, IceBottleIcon, NewspaperIcon, StopwatchIcon, TradeIcon, WarningIcon } from "@/components/xp/icons";
import { timeAgo } from "@/lib/news/feed";
import type { Notification } from "@/lib/notifications/derive";
import { useNotifications } from "@/lib/notifications/use-notifications";
import "./notifications.css";

const ICONS: Record<Notification["kind"], ComponentType<SVGProps<SVGSVGElement>>> = {
  iced: IceBottleIcon,
  due: StopwatchIcon,
  late: WarningIcon,
  edition: NewspaperIcon,
  video: CamcorderIcon,
  trade: TradeIcon,
};

export function NotificationsWindow() {
  const { items, ready, partial, seenAt, markAllSeen } = useNotifications();
  // Opening marks everything read, so remember the old mark to keep this visit's new items bold.
  const [seenBefore] = useState(() => (seenAt ? Date.parse(seenAt) : -Infinity));
  const [now] = useState(Date.now);
  const [saveError, setSaveError] = useState<string | null>(null);
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    markAllSeen().catch((e: Error) => setSaveError(e.message));
  }, [markAllSeen]);

  return (
    <div className="notifs">
      {saveError && (
        <p role="alert" className="notifs-note">
          Could not mark these as read ({saveError}). They will show as new next time.
        </p>
      )}
      {partial && ready && <p className="notifs-note">Some sources did not load, so this list may be missing items.</p>}
      {!ready ? (
        <p role="status" className="notifs-empty">
          Checking for news...
        </p>
      ) : items.length === 0 ? (
        <p className="notifs-empty">Nothing yet. Ices, trades, videos and new editions will show up here.</p>
      ) : (
        <ol aria-label="Notifications" className="notifs-list">
          {items.map((n) => {
            const Icon = ICONS[n.kind];
            const fresh = n.at > seenBefore;
            return (
              <li key={n.id} className={fresh ? "notifs-item notifs-new" : "notifs-item"}>
                <DrillLink to={n.target}>
                  <Icon width={24} height={24} className="notifs-icon" />
                  <span className="notifs-text">
                    <span className="notifs-title">
                      {fresh && <span className="sr-only">New: </span>}
                      {n.title}
                    </span>
                    <span className="notifs-body">{n.body}</span>
                  </span>
                  <time className="notifs-time" dateTime={new Date(n.at).toISOString()}>
                    {timeAgo(n.at, now)}
                  </time>
                </DrillLink>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
