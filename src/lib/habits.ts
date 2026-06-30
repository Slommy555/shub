// Consistency math for habits, derived purely from the set of ISO dates a
// habit was completed on. All "today" handling is in local calendar days.

import { addDays, parseISO } from './dates';

/** ISO dates (YYYY-MM-DD) for the last `n` days, oldest → newest, ending today. */
export function recentDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

/**
 * Consecutive completed days ending today (or yesterday — a not-yet-done today
 * doesn't break a streak until the day actually passes). 0 if neither is done.
 */
export function currentStreak(done: Set<string>, today: string): number {
  // Anchor on today if done, otherwise yesterday; if neither, the streak is 0.
  let cursor = done.has(today) ? today : addDays(today, -1);
  if (!done.has(cursor)) return 0;
  let streak = 0;
  while (done.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** The longest run of consecutive completed days in the whole history. */
export function longestStreak(done: Set<string>): number {
  if (done.size === 0) return 0;
  const sorted = [...done].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = addDays(sorted[i - 1], 1) === sorted[i] ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Completion rate over the trailing `windowDays`, as a 0–1 fraction. The window
 * never starts before the habit was created, so a brand-new habit isn't
 * penalised for days it didn't exist.
 */
export function completionRate(
  done: Set<string>,
  today: string,
  createdISO: string,
  windowDays = 30
): number {
  const windowStart = addDays(today, -(windowDays - 1));
  const start = createdISO > windowStart ? createdISO : windowStart;
  const startDate = parseISO(start);
  const todayDate = parseISO(today);
  const span = Math.round((todayDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (span <= 0) return 0;
  let hit = 0;
  for (let i = 0; i < span; i++) {
    if (done.has(addDays(start, i))) hit++;
  }
  return hit / span;
}
