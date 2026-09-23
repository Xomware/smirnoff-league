export interface Searchable {
  label: string;
  keywords?: string[];
}

// The score of letters merely appearing in order, the weakest match.
export const SCATTER = 10;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function inOrder(needle: string, hay: string): boolean {
  let at = 0;
  for (const ch of needle) {
    at = hay.indexOf(ch, at) + 1;
    if (at === 0) return false;
  }
  return true;
}

// 0 is no match. Higher tiers: the whole text starts with the query, a word
// does, the query is the words' initials, it sits inside a word, every query
// word starts some word, and last the letters merely appear in order.
export function matchScore(query: string, text: string): number {
  const q = norm(query);
  const t = norm(text);
  if (!q) return 0;
  if (t.startsWith(q)) return 100;
  if (` ${t}`.includes(` ${q}`)) return 80;
  const flat = q.replaceAll(" ", "");
  const initials = t
    .split(" ")
    .map((w) => w[0])
    .join("");
  if (flat.length > 1 && initials.startsWith(flat)) return 70;
  if (t.includes(q)) return 50;
  const words = q.split(" ");
  if (words.length > 1 && words.every((w) => ` ${t}`.includes(` ${w}`))) return 40;
  return inOrder(flat, t.replaceAll(" ", "")) ? SCATTER : 0;
}

// A keyword hit ranks just under the same hit on the label.
const itemScore = (query: string, { label, keywords = [] }: Searchable) =>
  Math.max(matchScore(query, label), ...keywords.map((k) => matchScore(query, k) * 0.9));

export const bestScore = (query: string, items: Searchable[]) => Math.max(0, ...items.map((i) => itemScore(query, i)));

// Ties keep the given order. `min` drops weaker matches, such as letters
// scattered through an unrelated name once a real match exists elsewhere.
export function rank<T extends Searchable>(query: string, items: T[], min = 1): T[] {
  return items
    .map((item) => ({ item, score: itemScore(query, item) }))
    .filter(({ score }) => score >= min)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}
