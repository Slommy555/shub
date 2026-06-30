// Intent parsing for the voice assistant. Sends the transcript to Claude (via
// the anthropic-proxy Edge Function) with a system prompt that asks for an
// `actions` array, then returns the raw action objects for the router to
// normalize. The recording/transcription flow is untouched — this only changes
// what we do with the transcript text.

import { supabase } from './supabase';
import { callClaudeText } from './anthropic';

export interface IntentContext {
  now: Date;
  habitNames: string[];
  templateNames: string[];
}

/** A raw action object as returned by Claude (validated later by the router). */
export interface RawAction {
  type: string;
  data: unknown;
}

function list(arr: string[], fallback = '(none)'): string {
  return arr.length ? arr.join(', ') : fallback;
}

export function buildIntentPrompt(ctx: IntentContext): string {
  return `You are a personal assistant embedded in a productivity app. The user has spoken a command or set of commands. Parse their intent and return a JSON object with an 'actions' array. Each action has a 'type' and associated data.

IMPORTANT: A separate system already handles to-dos, task scheduling, rescheduling, deletions, and work shifts. Do NOT create actions for tasks/to-dos, for moving or deleting tasks, or for work schedules — ignore any such parts of the transcript entirely. Only return the action types listed below; if the transcript contains none of them, return an empty actions array.

Possible action types:

1. complete_habits
   data: { habit_names: string[], all: boolean }
   Use for: when user says they completed habits, all habits, or specific ones by name
   If they say 'all my habits' or 'everything' set all: true and habit_names: []
   If they name specific habits set all: false and habit_names: [exact names as spoken]

2. start_workout
   data: { template_name: string | null, freestyle: boolean }
   Use for: when user says they want to start a workout, go to the gym, begin training etc.
   If they name a specific workout template set template_name to that name
   If no template mentioned set freestyle: true

3. log_weight
   data: { weight_lbs: number, notes: string | null }
   Use for: when user mentions their current weight or says they weighed themselves

4. set_reminder
   data: { text: string, datetime: string | null, recurring: string | null }
   Use for: any reminders the user asks to be set
   datetime: ISO string if a specific time is mentioned
   recurring: 'daily', 'weekly', or null

Today's date and time is ${ctx.now.toString()} (ISO ${ctx.now.toISOString()}).
The user's existing habit names are: ${list(ctx.habitNames)}.
The user's existing workout template names are: ${list(ctx.templateNames)}.

Return only a valid JSON object. No preamble, no markdown, no explanation.
Example: { "actions": [ { "type": "complete_habits", "data": { "habit_names": ["meditation", "reading"], "all": false } }, { "type": "log_weight", "data": { "weight_lbs": 185, "notes": null } } ] }`;
}

/** Pull the `actions` array out of Claude's text response, tolerant of fences. */
function extractActions(text: string): RawAction[] {
  let s = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  // Narrow to the outermost object if there's stray prose.
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1) s = s.slice(first, last + 1);
  try {
    const obj = JSON.parse(s) as { actions?: unknown };
    if (Array.isArray(obj.actions)) {
      return obj.actions.filter(
        (a): a is RawAction => !!a && typeof a === 'object' && typeof (a as RawAction).type === 'string'
      );
    }
  } catch {
    /* fall through */
  }
  return [];
}

/**
 * Send the transcript to Claude and return the raw actions. Uses the same
 * direct-browser transport as the task pass. Throws on transport errors so the
 * caller can decide whether to surface them.
 */
export async function parseIntents(transcript: string, ctx: IntentContext): Promise<RawAction[]> {
  const text = await callClaudeText(buildIntentPrompt(ctx), transcript, 2000);
  return extractActions(text);
}

/** Fetch everything Claude needs to match spoken names to real records. */
export async function gatherIntentContext(): Promise<IntentContext> {
  const [habits, templates] = await Promise.all([
    supabase.from('habits').select('name').eq('archived', false),
    supabase.from('workout_templates').select('name'),
  ]);

  return {
    now: new Date(),
    habitNames: (habits.data ?? []).map((r) => r.name as string),
    templateNames: (templates.data ?? []).map((r) => r.name as string),
  };
}
