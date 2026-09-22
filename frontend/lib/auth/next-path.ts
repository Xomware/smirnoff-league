/**
 * Where to send someone after the Google round trip.
 *
 * Cognito returns only to the one registered callback URI, so the page the
 * visitor started on is lost unless it is stashed before the redirect.
 * sessionStorage rather than localStorage: a stale target would otherwise
 * hijack an unrelated sign-in days later.
 */

const NEXT_KEY = "smirnoff.next";

// The stored value ends up in the browser's location after sign-in, so anything
// that is not a same-origin path would be an open redirect. "//" is
// protocol-relative and goes off-site; browsers treat "\" like "/".
export function isSafePath(value: string | null | undefined): value is string {
  return Boolean(
    value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"),
  );
}

export function rememberNextPath(path: string): void {
  try {
    if (isSafePath(path)) window.sessionStorage.setItem(NEXT_KEY, path);
  } catch {
    // Storage blocked (e.g. Safari private mode). Landing on "/" is fine.
  }
}

export function takeNextPath(): string {
  try {
    const stored = window.sessionStorage.getItem(NEXT_KEY);
    window.sessionStorage.removeItem(NEXT_KEY);
    if (isSafePath(stored)) return stored;
  } catch {
    // Storage blocked; fall through to "/".
  }
  return "/";
}
