import type { DrillTarget } from "@/components/views/drill-link";
import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import type { Writeup } from "@/lib/api/writeups";
import type { SleeperTransaction } from "@/lib/sleeper/types";

export interface Notification {
  id: string;
  kind: "iced" | "due" | "late" | "edition" | "video" | "trade";
  at: number;
  title: string;
  body: string;
  target: DrillTarget;
}

export interface NotificationSources {
  myRosterId: number;
  ledger: Ledger | null;
  writeups: Writeup[];
  videos: Video[];
  transactions: SleeperTransaction[];
  teamName: (rosterId: number) => string;
  now: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CAUSE: Record<LedgerIce["reason"], string> = {
  zero: "a starter scored zero",
  empty: "an empty starting slot",
  lowest: "lowest score",
  admin: "added by the commish",
  late: "late",
};

const etFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

interface EtTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  /** ET minus UTC, in ms. */
  offset: number;
}

function et(ms: number): EtTime {
  const p: Record<string, number> = Object.fromEntries(etFormat.formatToParts(ms).map(({ type, value }) => [type, Number(value)]));
  const { year, month, day, hour, minute } = p;
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  return { year, month, day, hour, minute, weekday: new Date(wall).getUTCDay(), offset: wall - Math.floor(ms / 60_000) * 60_000 };
}

// ET wall-clock to epoch ms. The second pass picks up the offset on the far
// side of a DST change; Date.UTC normalizes a day that under- or overflows.
function etToMs(year: number, month: number, day: number, hour: number, minute = 0): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  return wall - et(wall - et(wall).offset).offset;
}

const plusEtDays = (ms: number, days: number) => {
  const p = et(ms);
  return etToMs(p.year, p.month, p.day + days, p.hour, p.minute);
};

function dueLabel(deadline: number): string {
  const p = et(deadline);
  const minutes = p.minute ? `:${String(p.minute).padStart(2, "0")}` : "";
  return `Ice due ${WEEKDAYS[p.weekday]} ${p.hour % 12 || 12}${minutes} ${p.hour < 12 ? "AM" : "PM"} ET`;
}

function iceItems({ ledger, myRosterId, now }: NotificationSources): Notification[] {
  if (!ledger) return [];
  const weeks = new Map(ledger.weeks.map((w) => [w.week, w]));
  const deadline = (week: number) => {
    const d = weeks.get(week)?.deadlineUtc;
    return d ? Date.parse(d) : null;
  };
  const mine = ledger.ices.filter((i) => i.rosterId === myRosterId);
  const items: Notification[] = [];

  for (const ice of mine) {
    const due = deadline(ice.week);
    if (ice.reason === "late") {
      if (due === null) continue;
      const n = Number(ice.iceId.split("#LATE")[1] ?? 1);
      const body = `Week ${ice.week}'s ice missed the deadline`;
      items.push({ id: `late:${ice.iceId}`, kind: "late", at: plusEtDays(due, 7 * (n - 1)), title: "Late ice added", body, target: { kind: "ices" } });
      continue;
    }
    const finalized = weeks.get(ice.week)?.finalizedAt;
    const at = finalized ? Date.parse(finalized) : due === null ? null : due - 6 * DAY;
    if (at === null) continue;
    const body = `Week ${ice.week}: ${CAUSE[ice.reason]}`;
    items.push({ id: `iced:${ice.iceId}`, kind: "iced", at, title: "You got iced", body, target: { kind: "team", rosterId: myRosterId } });
  }

  for (const week of ledger.weeks) {
    const due = deadline(week.week);
    if (due === null) continue;
    const owed = mine.filter((i) => i.week === week.week && i.reason !== "late" && i.status === "owed").length;
    const p = et(due);
    const friday = etToMs(p.year, p.month, p.day - ((p.weekday + 2) % 7), 0);
    if (!owed || now < friday || now >= due) continue;
    const body = `You owe ${owed} ${owed === 1 ? "ice" : "ices"} for Week ${week.week}`;
    const w = `W${String(week.week).padStart(2, "0")}`;
    items.push({ id: `due:${w}`, kind: "due", at: friday, title: dueLabel(due), body, target: { kind: "ices" } });
    for (const hours of [48, 6]) {
      const at = due - hours * HOUR;
      if (now >= at) items.push({ id: `due${hours}h:${w}`, kind: "due", at, title: `Ice due in ${hours} hours`, body, target: { kind: "ices" } });
    }
  }
  return items;
}

export function deriveNotifications(s: NotificationSources): Notification[] {
  const editions = s.writeups.map(
    (w): Notification => ({ id: `edition:${w.mediaId}`, kind: "edition", at: Date.parse(w.publishedAt), title: "New edition posted", body: w.title, target: { kind: "writeup", week: w.week } }),
  );
  const videos = s.videos.map((v): Notification => {
    const who = v.rosterIds.includes(s.myRosterId) ? "You" : (v.uploaderName ?? s.teamName(v.rosterIds[0]));
    return { id: `video:${v.mediaId}`, kind: "video", at: Date.parse(v.createdAt), title: "New chug video", body: `${who} chugged for Week ${v.week}`, target: { kind: "videos" } };
  });
  const trades = s.transactions
    .filter((t) => t.type === "trade" && t.status === "complete" && t.roster_ids.includes(s.myRosterId))
    .map((t): Notification => {
      const others = t.roster_ids.filter((r) => r !== s.myRosterId).map(s.teamName);
      return { id: `trade:${t.transaction_id}`, kind: "trade", at: t.status_updated, title: "Trade completed", body: `You traded with ${others.join(" and ")}`, target: { kind: "news" } };
    });

  return [...iceItems(s), ...editions, ...videos, ...trades]
    .filter((n) => n.at <= s.now)
    .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

export function unreadCount(items: Notification[], seenAt: string | null | undefined): number {
  const seen = seenAt ? Date.parse(seenAt) : -Infinity;
  return items.filter((n) => n.at > seen).length;
}
