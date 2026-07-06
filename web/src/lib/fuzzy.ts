// Tiny fuzzy matcher for mapping spoken names to real records (habits, tasks,
// templates). Case-insensitive, partial/substring, with token-overlap fallback.

export function matchScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase().trim();
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (t.includes(q) || q.includes(t)) return 0.85;
  const qTokens = new Set(q.split(/\s+/));
  const tTokens = t.split(/\s+/);
  const hits = tTokens.filter((w) => qTokens.has(w)).length;
  if (hits === 0) return 0;
  return 0.4 + 0.4 * (hits / Math.max(qTokens.size, tTokens.length));
}

export interface Ranked<T> {
  item: T;
  score: number;
}

/** Items scoring at/above `threshold`, best first. */
export function rankMatches<T>(
  query: string,
  items: T[],
  key: (item: T) => string,
  threshold = 0.4
): Ranked<T>[] {
  return items
    .map((item) => ({ item, score: matchScore(query, key(item)) }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
