// Anthropic client for the Voice Input feature.
//
// Calls go through the `anthropic-proxy` Supabase Edge Function, which holds the
// API key as a server-side secret (ANTHROPIC_API_KEY) — the key never reaches
// the browser bundle. The function requires the user's Supabase session JWT,
// which supabase-js attaches to functions.invoke automatically.

import { weekdayShort } from './dates';
import { supabase } from './supabase';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4000;

/** Voice is available whenever the app is running (the proxy holds the key). */
export const voiceEnabled = true;

export interface ParsedTask {
  text: string;
  category: string;
  priority: 'high' | 'med' | 'low';
  due_date: string | null;
  scheduled_date: string | null;
  /** "HH:MM" 24h — set for timed events (hike, appointment). null for untimed tasks. */
  start_time?: string | null;
  end_time?: string | null;
  subtasks?: string[];
  unsure?: Record<string, string>;
  /** When set, this item is a request to MOVE an existing task (not a new one). */
  reschedule_id?: string | null;
  /** When set, this item is a request to DELETE an existing task. */
  delete_id?: string | null;
  /** Short explanation for a reschedule or deletion. */
  reason?: string;
  /** When set, this item updates the user's recurring work schedule (not a task). */
  work_shift?: { weekdays: number[]; start: string; end: string } | null;
}

/** A lightweight reference to an existing task Claude may rearrange. */
export interface ExistingTaskRef {
  id: string;
  text: string;
  scheduled_date: string | null;
  due_date: string | null;
  priority: 'high' | 'med' | 'low';
}

export interface DayLoad {
  date: string; // YYYY-MM-DD
  load: number; // weighted by time consumption (Long=3, Medium=2, Quick=1)
  isWorkDay: boolean;
  shift: string | null; // e.g. "22:00–06:00"
  overnight: boolean;
  freeHours: number; // approx hours left after work shift + sleep
}

/** A weekday the user currently has a recurring work shift on. */
export interface WorkShiftRef {
  weekday: number; // 0 = Sunday … 6 = Saturday
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

const WEEKDAY_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

function buildSystemPrompt(
  categories: string[],
  today: string,
  workload: DayLoad[],
  workDayLabels: string[],
  sleepHours: number,
  existingTasks: ExistingTaskRef[],
  workShifts: WorkShiftRef[]
): string {
  const cats = categories.length ? categories.join(', ') : 'work, personal, school, health, other';
  const fallback = categories[0] ?? 'other';
  const loadLines = workload.length
    ? workload
        .map((d) => {
          const tags = [weekdayShort(d.date)];
          if (d.isWorkDay && d.shift) tags.push(`work ${d.shift}${d.overnight ? ' OVERNIGHT' : ''}`);
          return `  ${d.date} (${tags.join(', ')}): ~${d.freeHours}h free, load ${d.load}`;
        })
        .join('\n')
    : '  (no tasks scheduled yet)';
  const workDaysText = workDayLabels.length ? workDayLabels.join(', ') : 'none specified';
  const workShiftsText = workShifts.length
    ? workShifts.map((w) => `${WEEKDAY_FULL[w.weekday]} ${w.start}–${w.end}`).join(', ')
    : '(none set)';
  const existingLines = existingTasks.length
    ? existingTasks
        .map(
          (t) =>
            `  [${t.id}] "${t.text}" — on ${t.scheduled_date ?? 'unscheduled'}` +
            `${t.due_date ? `, due ${t.due_date}` : ''} (${t.priority})`
        )
        .join('\n')
    : '  (none)';
  return [
    'You are a smart task planner. The user has dictated things they need to do.',
    'Parse their words into structured tasks. For each task return these fields:',
    '',
    '- text: the task description, cleaned up and concise.',
    `- category: one of [${cats}] — infer from context. If none clearly fit, use "${fallback}".`,
    '- priority: high, med, or low — estimated TIME CONSUMPTION (high = a lot of time,',
    '  med = moderate, low = quick). Infer from the task.',
    '- due_date: the HARD DEADLINE as an ISO date (YYYY-MM-DD) — when the assignment is',
    '  actually due (e.g. in Canvas). null if no deadline was mentioned.',
    '- scheduled_date: the day the user should actually WORK ON the task (ISO date). This is',
    '  the day it will be listed under. It MUST be on or before due_date.',
    '- start_time / end_time: 24h "HH:MM" strings. Set these ONLY for a TIMED EVENT that',
    '  happens in a specific window (a hike, an appointment, a meeting, dinner). For such an',
    '  event also set scheduled_date to the day it happens. Ordinary to-dos with no fixed time',
    '  leave both null. If the user clearly implies an event but the time is AMBIGUOUS or',
    '  unstated, leave both null and add an `unsure.start_time` (and/or end_time) question',
    '  instead of guessing a time.',
    '- subtasks: an array of short strings. Keep these to an ABSOLUTE MINIMUM. Most tasks need',
    '  NONE — default to an empty array []. Only add subtasks when a task genuinely cannot be',
    '  done in one sitting AND the breakdown is non-obvious; even then use 2-3 at most. Never',
    '  pad a simple task with steps it does not need.',
    '- unsure: an object mapping field name (text, category, priority, due_date, scheduled_date,',
    '  start_time, end_time) to a short clarifying question. Only include fields you are genuinely',
    '  uncertain about.',
    '',
    'WORK SCHEDULE:',
    'When the user says they WORK on certain day(s) (e.g. "I work Tuesdays and Thursdays 9 to 5",',
    '"add a shift Saturday morning 8-noon"), DO NOT make it a task. Instead return a work directive:',
    '  { "work_shift": { "weekdays": [<0-6>...], "start": "HH:MM", "end": "HH:MM" } }',
    'weekdays use 0=Sunday … 6=Saturday. This updates the user\'s RECURRING weekly work schedule.',
    `The user's current recurring work shifts are: ${workShiftsText}. Do not re-emit a shift that`,
    'already matches. If the work time is unclear, still emit the work_shift with your best guess',
    'for start/end (the user can adjust it on confirmation).',
    '',
    'SCHEDULING RULES for scheduled_date:',
    '1. Each day below shows ~free hours (time left after the work shift and',
    `   ~${sleepHours}h of sleep) and current weighted load (Long task = 3, Medium = 2, Quick = 1).`,
    '   Schedule a task on a day with enough FREE HOURS and a LOWER load. Do not exceed a day\'s',
    '   free hours; spread big/Long tasks onto earlier days with more free time.',
    `2. The user works on these weekdays: ${workDaysText}. PREFER days the user does NOT work.`,
    '   Use work days only when necessary or for Quick tasks. Never schedule after the due date.',
    '3. OVERNIGHT shifts consume the night and the worker sleeps the following morning, so both',
    '   the shift day and the morning after have little usable time — avoid demanding work then.',
    '4. Quick tasks can land on the due date; Long tasks should start several days earlier.',
    '',
    'REARRANGING EXISTING TASKS:',
    'You can move the user\'s EXISTING tasks (listed below) by returning a move object:',
    '  { "reschedule_id": "<existing task id>", "scheduled_date": "<new ISO date>",',
    '    "reason": "<short why>" }',
    'Emit moves in EITHER of these cases:',
    '(a) A NEW task you are adding would overload a day — move existing tasks to make room.',
    '(b) The user EXPLICITLY asks to rebalance / rearrange / re-plan their schedule, OR tells you',
    '    new info that changes a day\'s free time (a new work shift, an event, a cancellation). In',
    '    that case ACTIVELY redistribute the existing tasks so no day exceeds its free hours, work',
    '    days are avoided where possible, and nothing lands after its due date — even if you are',
    '    adding NO new task. A pure rebalance request may return only move objects and no tasks.',
    'Rules: never move a task past its own due date; only emit a move when the date actually',
    'changes; keep moves to the minimum needed. When the user is NOT asking to rebalance and',
    'nothing overloads a day, return NO moves.',
    'The existing tasks you may rearrange (id in brackets):',
    existingLines,
    '',
    'REMOVING / CANCELING TASKS:',
    'When the user says they no longer need, are NOT doing, canceled, or want to remove/delete one of',
    'their EXISTING tasks (e.g. "I\'m not hiking anymore", "cancel the dentist appointment", "drop the',
    'grocery run"), return a delete object:',
    '  { "delete_id": "<existing task id>", "reason": "<short why>" }',
    'Match the task by meaning against the existing list above. Only delete a task that actually',
    'exists; never delete a task you are creating in this same response. If you are unsure which task',
    'they mean, do NOT emit a delete — leave it out rather than guess.',
    '',
    'REMINDERS (handled elsewhere — IGNORE):',
    'A separate system handles timed reminders and alarms. When the user asks to BE REMINDED of',
    'something or to set a reminder/alarm (e.g. "remind me to take my supplements at 8am", "set a',
    'reminder to call mom", "set an alarm for 6"), DO NOT create a task, event, or any object for',
    'it — omit it entirely. Only treat it as a task if they explicitly ask to add a task/to-do',
    'rather than a reminder.',
    '',
    `Today's date is ${today}.`,
    '',
    'Upcoming days (free time, work shifts, current load):',
    loadLines,
    '',
    'Return a JSON array containing new task objects, any reschedule objects, any delete objects,',
    'and any work_shift objects, and nothing else. No preamble, no markdown.',
  ].join('\n');
}

/**
 * Pull out every top-level {...} object from a string, parsing each on its own.
 * Tolerant of truncation (a cut-off final object) and of a single malformed
 * object — those are simply skipped rather than failing the whole batch.
 */
function salvageObjects(s: string): unknown[] {
  const out: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          out.push(JSON.parse(s.slice(start, i + 1)));
        } catch {
          /* skip malformed object */
        }
        start = -1;
      }
    }
  }
  return out;
}

function extractJsonArray(raw: string): unknown {
  let s = raw.trim();
  // Strip accidental code fences.
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  const start = s.indexOf('[');
  const region = start === -1 ? s : s.slice(start);

  // Fast path: well-formed array.
  const end = region.lastIndexOf(']');
  if (end !== -1) {
    try {
      return JSON.parse(region.slice(0, end + 1));
    } catch {
      /* fall through to salvage */
    }
  }

  // Resilient path: recover whatever complete task objects we can.
  const objs = salvageObjects(region);
  if (objs.length) return objs;
  // A truly empty response signals a failed call — surface it so the user can
  // retry. A non-empty response with no array just means "no tasks" (e.g. the
  // transcript was only a habit/weight/food/reminder command), which is normal.
  if (s === '') throw new Error('Claude returned an empty response. Try again.');
  return [];
}

/** Send the transcript to Claude and return parsed tasks. Throws on failure. */
export async function parseTranscript(
  transcript: string,
  options: {
    categories: string[];
    today: string;
    workload: DayLoad[];
    workDayLabels: string[];
    sleepHours: number;
    existingTasks?: ExistingTaskRef[];
    workShifts?: WorkShiftRef[];
  }
): Promise<ParsedTask[]> {
  const system = buildSystemPrompt(
    options.categories,
    options.today,
    options.workload,
    options.workDayLabels,
    options.sleepHours,
    options.existingTasks ?? [],
    options.workShifts ?? []
  );
  const text = await callClaudeText(system, transcript, MAX_TOKENS);
  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) throw new Error('Claude returned an unexpected shape.');
  return parsed as ParsedTask[];
}

/**
 * Low-level single-turn Messages call, shared by both voice passes. Routes
 * through the anthropic-proxy Edge Function (key stays server-side) and returns
 * the response text. Throws on transport/proxy errors.
 */
export async function callClaudeText(
  system: string,
  userText: string,
  maxTokens = MAX_TOKENS
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('anthropic-proxy', {
    body: {
      system,
      messages: [{ role: 'user', content: userText }],
      model: MODEL,
      max_tokens: maxTokens,
    },
  });
  if (error) {
    throw new Error(
      `Claude request failed: ${error.message}. ` +
        'Ensure the anthropic-proxy Edge Function is deployed with the ANTHROPIC_API_KEY secret set.'
    );
  }
  return (data as { content?: { text?: string }[] })?.content?.[0]?.text ?? '';
}
