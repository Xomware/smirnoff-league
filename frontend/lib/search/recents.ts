const KEY = "smirnoff:palette-recents";
const MAX = 5;

// Storage can throw (private mode, blocked cookies). Recents are a nicety, so
// then the palette just opens without them.
export function loadRecents(): string[] {
  try {
    const ids: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function saveRecent(id: string) {
  const ids = [id, ...loadRecents().filter((r) => r !== id)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Not remembered; the pick itself already happened.
  }
}
