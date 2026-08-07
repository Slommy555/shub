// Cycle math for training programs. Everything is keyed off calendar days in the
// user's local zone (YYYY-MM-DD), matching the `start_date` column.
//
// A program repeats a split of `cycle_length` days (7 or 8). A "week" is one
// pass of that cycle — for an 8-day cycle the days are deliberately NOT tied to
// weekdays, so Day 1 drifts across the calendar as the block runs.

import { addDays, parseISO, toISODate } from './dates';
import type {
  ProgramDay,
  ProgramWeek,
  ResolvedProgramDay,
  WorkoutProgram,
} from '../types/workout';

/** Whole calendar days from `fromISO` to `toISO` (negative before the start). */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = parseISO(fromISO);
  const to = parseISO(toISO);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * The cycle day (1..cycle_length) a date lands on.
 *
 * `days_since_program_start % cycle_length + 1` — so the start date itself is
 * Day 1. Dates before the start wrap backwards rather than going negative.
 */
export function cycleDayFor(program: WorkoutProgram, iso: string): number {
  const len = Math.max(1, program.cycle_length);
  const since = daysBetween(program.start_date, iso);
  return (((since % len) + len) % len) + 1;
}

/**
 * The 1-based week (cycle pass) a date falls in. Returns null when the date is
 * before the program starts or past its final week.
 */
export function weekNumberFor(program: WorkoutProgram, iso: string): number | null {
  const len = Math.max(1, program.cycle_length);
  const since = daysBetween(program.start_date, iso);
  if (since < 0) return null;
  const week = Math.floor(since / len) + 1;
  return week > program.total_weeks ? null : week;
}

/** The first calendar date of a week (cycle pass). */
export function weekStartISO(program: WorkoutProgram, weekNumber: number): string {
  return addDays(program.start_date, (weekNumber - 1) * Math.max(1, program.cycle_length));
}

/** The ISO date a specific (week, cycle day) pair falls on. */
export function dateForCycleDay(
  program: WorkoutProgram,
  weekNumber: number,
  dayNumber: number
): string {
  return addDays(weekStartISO(program, weekNumber), dayNumber - 1);
}

/** "Aug 7 – Aug 13" for a week row. */
export function weekRangeLabel(program: WorkoutProgram, weekNumber: number): string {
  const start = weekStartISO(program, weekNumber);
  const end = addDays(start, Math.max(1, program.cycle_length) - 1);
  const fmt = (iso: string) =>
    parseISO(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** The last date covered by the program (its final week's final day). */
export function programEndISO(program: WorkoutProgram): string {
  return addDays(program.start_date, program.total_weeks * Math.max(1, program.cycle_length) - 1);
}

/**
 * A day as it actually resolves: the default split row, with the week's
 * `override_days` patch applied on top when one exists for that cycle day.
 */
export function resolveDay(
  dayNumber: number,
  defaults: ProgramDay[],
  week: ProgramWeek | null | undefined
): ResolvedProgramDay {
  const base = defaults.find((d) => d.day_number === dayNumber);
  const patch = week?.override_days?.[String(dayNumber)];
  const resolved: ResolvedProgramDay = {
    day_number: dayNumber,
    template_id: base?.template_id ?? null,
    label: base?.label ?? null,
    is_rest: base?.is_rest ?? false,
    overridden: false,
  };
  if (!patch) return resolved;
  if ('template_id' in patch) resolved.template_id = patch.template_id ?? null;
  if ('label' in patch) resolved.label = patch.label ?? null;
  if ('is_rest' in patch) resolved.is_rest = patch.is_rest ?? false;
  resolved.overridden = true;
  return resolved;
}

/** Round a weight down to the nearest 5 lb (deload pre-fill rule). */
export function roundDownTo5(weight: number): number {
  return Math.max(0, Math.floor(weight / 5) * 5);
}

/** Today, as the ISO date the cycle math works in. */
export function todayForProgram(): string {
  return toISODate(new Date());
}
