import { request } from "@/lib/api/users";
import { windowId, type WindowView } from "@/lib/desktop/windows";

export type ActivityKind = "signin" | "open" | "drill" | "upload" | "publish";

interface ActivityEvent {
  kind: ActivityKind;
  target: string;
  at: string;
}

const FLUSH_MS = 30_000;
// The server's caps: a batch of 50, a target of 120 characters.
const BATCH = 50;
const MAX_TARGET = 120;
const SIGNIN_KEY = "smirnoff.activity.signin";

let queue: ActivityEvent[] = [];
let running = false;

/** A window or screen as the admin timeline names it, e.g. `team:6`. */
export const viewTarget = ({ kind, params }: WindowView) => windowId(kind, params);

export function track(kind: ActivityKind, target = ""): void {
  if (!running) return;
  queue.push({ kind, target: target.slice(0, MAX_TARGET), at: new Date().toISOString() });
}

function flush(): void {
  while (queue.length) {
    const events = queue.splice(0, BATCH);
    // Telemetry must never break the app or nag the user, so a failed batch
    // is dropped rather than retried or surfaced.
    request("/activity/track", { method: "POST", body: JSON.stringify({ events }), keepalive: true }).catch(() => {});
  }
}

const onVisibility = () => document.visibilityState === "hidden" && flush();

/** Runs only while signed in; the returned stop discards anything unsent. */
export function startTracking(): () => void {
  running = true;
  if (!sessionStorage.getItem(SIGNIN_KEY)) {
    sessionStorage.setItem(SIGNIN_KEY, "1");
    track("signin");
  }
  const timer = setInterval(flush, FLUSH_MS);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    running = false;
    queue = [];
    sessionStorage.removeItem(SIGNIN_KEY);
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
