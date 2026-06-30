// Turns Claude's raw `actions` array into a fully-resolved ReviewModel: habits
// fuzzy-matched to real records, workout templates matched. The sections
// rendered inside VoicePopup come from this; nothing here writes to the database
// (that's claudeActions.ts on confirm). Unknown action types are ignored
// silently. Tasks/reschedules/deletions/work-shifts are intentionally NOT
// handled here — the existing parseTranscript flow owns those.

import { supabase } from './supabase';
import { todayISO } from './dates';
import { rankMatches } from './fuzzy';
import type { IntentContext, RawAction } from './intent';

export interface HabitReviewModel {
  all: boolean;
  /** Habits that will be marked complete today (already-done ones excluded). */
  targets: { id: string; name: string }[];
  /** Names Claude asked for that matched nothing. */
  unmatched: string[];
}

export interface WorkoutReviewModel {
  freestyle: boolean;
  templateName: string | null;
  /** Best fuzzy match against existing templates, for the preview label. */
  matchedName: string | null;
}

export interface WeightReviewModel {
  id: string;
  weight_lbs: number;
  notes: string | null;
}

export interface ReminderReviewModel {
  id: string;
  text: string;
  datetime: string | null; // ISO
  recurring: 'daily' | 'weekly' | null;
}

export interface ReviewModel {
  habits: HabitReviewModel | null;
  workout: WorkoutReviewModel | null;
  weight: WeightReviewModel | null;
  reminders: ReminderReviewModel[];
}

export function emptyReview(): ReviewModel {
  return {
    habits: null,
    workout: null,
    weight: null,
    reminders: [],
  };
}

/** True when a review has at least one actionable section. */
export function reviewHasContent(r: ReviewModel): boolean {
  return (
    (r.habits != null && r.habits.targets.length > 0) ||
    r.workout != null ||
    r.weight != null ||
    r.reminders.length > 0
  );
}

const uid = () => crypto.randomUUID();

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}
function asNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve a raw actions array into a ReviewModel. Performs the async lookups
 * (habit fetches) needed to build previews.
 */
export async function prepareReview(
  actions: RawAction[],
  ctx: IntentContext
): Promise<ReviewModel> {
  const review = emptyReview();

  // Supporting data fetched once if any action needs it.
  const needHabits = actions.some((a) => a.type === 'complete_habits');

  const [habitRows, todayLogs] = await Promise.all([
    needHabits
      ? supabase.from('habits').select('id, name').eq('archived', false)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    needHabits
      ? supabase.from('habit_logs').select('habit_id').eq('date', todayISO())
      : Promise.resolve({ data: [] as { habit_id: string }[] }),
  ]);

  const habits = (habitRows.data ?? []) as { id: string; name: string }[];
  const doneHabitIds = new Set((todayLogs.data ?? []).map((r) => r.habit_id));

  for (const action of actions) {
    switch (action.type) {
      case 'complete_habits': {
        const d = (action.data ?? {}) as { habit_names?: unknown; all?: unknown };
        const all = d.all === true;
        const names = Array.isArray(d.habit_names) ? d.habit_names.map(String) : [];
        const targets: { id: string; name: string }[] = [];
        const unmatched: string[] = [];
        if (all) {
          for (const h of habits) if (!doneHabitIds.has(h.id)) targets.push(h);
        } else {
          for (const name of names) {
            const ranked = rankMatches(name, habits, (h) => h.name);
            const hit = ranked.find((m) => !doneHabitIds.has(m.item.id)) ?? ranked[0];
            if (hit) {
              if (!targets.some((t) => t.id === hit.item.id) && !doneHabitIds.has(hit.item.id)) {
                targets.push(hit.item);
              }
            } else {
              unmatched.push(name);
            }
          }
        }
        const prev = review.habits;
        review.habits = {
          all: all || (prev?.all ?? false),
          targets: mergeById(prev?.targets ?? [], targets),
          unmatched: [...(prev?.unmatched ?? []), ...unmatched],
        };
        break;
      }

      case 'start_workout': {
        const d = (action.data ?? {}) as { template_name?: unknown; freestyle?: unknown };
        const templateName = asString(d.template_name);
        const matched = templateName
          ? rankMatches(templateName, ctx.templateNames, (n) => n)[0]?.item ?? null
          : null;
        review.workout = {
          freestyle: d.freestyle === true || !templateName,
          templateName,
          matchedName: matched,
        };
        break;
      }

      case 'log_weight': {
        const d = (action.data ?? {}) as { weight_lbs?: unknown; notes?: unknown };
        const w = asNumber(d.weight_lbs);
        if (w != null && w > 0) {
          review.weight = { id: uid(), weight_lbs: w, notes: asString(d.notes) };
        }
        break;
      }

      case 'set_reminder': {
        const d = (action.data ?? {}) as { text?: unknown; datetime?: unknown; recurring?: unknown };
        const text = asString(d.text);
        if (!text) break;
        const recurring =
          d.recurring === 'daily' || d.recurring === 'weekly' ? d.recurring : null;
        review.reminders.push({ id: uid(), text, datetime: asString(d.datetime), recurring });
        break;
      }

      default:
        // Unknown / task-owned action type — ignore silently.
        break;
    }
  }

  return review;
}

function mergeById(
  a: { id: string; name: string }[],
  b: { id: string; name: string }[]
): { id: string; name: string }[] {
  const seen = new Set(a.map((x) => x.id));
  return [...a, ...b.filter((x) => !seen.has(x.id))];
}
