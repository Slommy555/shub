// Supabase Edge Function: daily-brief-push
//
// Triggered by pg_cron every minute. For each user with notifications enabled,
// if it's their chosen local time (±1 min) and no brief was sent today, it
// collects the day's data, asks Claude for a concise plain-text brief, sends it
// as a push (via FCM), and logs the full brief for the in-app bell/modal.
//
// Deploy:  supabase functions deploy daily-brief-push
// Secrets: FCM_SERVER_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

import {
  isTimeToSend,
  localDate,
  logNotification,
  sendPushToUser,
  serviceClient,
} from '../_shared/push.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-sonnet-4-6';
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const SYSTEM_PROMPT =
  'You are a personal daily briefing assistant. Generate a concise, friendly, ' +
  'well-structured daily brief from the user data provided. Adapt length to how ' +
  'much is going on — light day, keep it short; lots going on, be thorough. Use ' +
  'plain text with simple bullet lines (•). Do NOT use markdown headers (#) or ' +
  '*asterisks*. Include time-management suggestions only if there are enough ' +
  'tasks/events to warrant them. Be encouraging and practical, not robotic. End ' +
  'with a short motivational line if it fits.';

interface Sections {
  schedule: boolean; tasks: boolean; habits: boolean;
  workout: boolean; budget: boolean; notes: boolean;
}

/** Flatten a Tiptap doc to plain text (best-effort) for note snippets. */
function tiptapText(content: unknown): string {
  try {
    const walk = (n: any): string => {
      if (!n) return '';
      if (n.type === 'text') return n.text ?? '';
      if (Array.isArray(n.content)) return n.content.map(walk).join(' ');
      return '';
    };
    return walk(content).replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

async function collect(db: any, userId: string, today: string, sections: Sections) {
  const data: Record<string, unknown> = {};

  if (sections.tasks || sections.schedule) {
    const { data: tasks } = await db
      .from('tasks')
      .select('text, done, due_date, scheduled_date, start_time, end_time')
      .eq('user_id', userId)
      .eq('done', false);
    const list = (tasks ?? []) as any[];
    if (sections.tasks) {
      data.tasks_due_or_overdue = list
        .filter((t) => (t.due_date && t.due_date <= today) || t.scheduled_date === today)
        .map((t) => ({ text: t.text, due: t.due_date, overdue: t.due_date && t.due_date < today }));
    }
    if (sections.schedule) {
      data.todays_events = list
        .filter((t) => (t.scheduled_date === today || t.due_date === today) && t.start_time)
        .map((t) => ({ text: t.text, start: t.start_time, end: t.end_time }))
        .sort((a, b) => String(a.start).localeCompare(String(b.start)));
    }
  }

  if (sections.habits) {
    const { data: habits } = await db
      .from('habits')
      .select('id, name')
      .eq('user_id', userId)
      .eq('archived', false);
    const { data: logs } = await db
      .from('habit_logs')
      .select('habit_id')
      .eq('date', today);
    const done = new Set((logs ?? []).map((l: any) => l.habit_id));
    data.habits = (habits ?? []).map((h: any) => ({ name: h.name, done: done.has(h.id) }));
  }

  if (sections.workout) {
    const { data: pref } = await db
      .from('user_preferences')
      .select('workout_schedule')
      .eq('user_id', userId)
      .maybeSingle();
    const sched = (pref?.workout_schedule ?? {}) as Record<string, string>;
    const key = DOW[new Date(`${today}T12:00:00`).getDay()];
    data.workout_today = sched[key] || 'Rest Day';
  }

  if (sections.budget) {
    const monthStart = today.slice(0, 7) + '-01';
    const { data: txs } = await db
      .from('budget_transactions')
      .select('type, amount, date')
      .eq('user_id', userId)
      .gte('date', monthStart);
    const list = (txs ?? []) as any[];
    const todaySpent = list.filter((t) => t.type === 'expense' && t.date === today)
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const monthSpent = list.filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    data.budget = { spent_today: todaySpent, spent_this_month: monthSpent };
  }

  if (sections.notes) {
    const { data: notes } = await db
      .from('notes')
      .select('title, content')
      .eq('user_id', userId)
      .eq('include_in_brief', true);
    data.flagged_notes = (notes ?? []).map((n: any) => ({
      title: n.title,
      snippet: tiptapText(n.content).slice(0, 240),
    }));
  }

  return data;
}

async function generateBrief(payload: unknown): Promise<string> {
  if (!ANTHROPIC_API_KEY) return 'Good morning! (Set ANTHROPIC_API_KEY to enable AI briefs.)';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is today's data as JSON. Write my daily brief.\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    }),
  });
  const json = await res.json();
  const text = json?.content?.[0]?.text;
  return typeof text === 'string' && text.trim() ? text.trim() : 'Good morning! Have a great day.';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  const db = serviceClient();

  const { data: users } = await db
    .from('user_preferences')
    .select('user_id, notification_time, notification_timezone, notification_sections')
    .eq('notification_enabled', true);

  let sent = 0;
  for (const u of (users ?? []) as any[]) {
    const tz = u.notification_timezone || 'America/Los_Angeles';
    if (!isTimeToSend(u.notification_time || '07:00', tz)) continue;

    const today = localDate(tz);
    // Already sent a brief today?
    const { data: existing } = await db
      .from('notification_log')
      .select('id')
      .eq('user_id', u.user_id)
      .eq('type', 'daily_brief')
      .gte('sent_at', `${today}T00:00:00`)
      .limit(1);
    if (existing && existing.length > 0) continue;

    const sections: Sections = {
      schedule: true, tasks: true, habits: true, workout: true, budget: true, notes: true,
      ...(u.notification_sections ?? {}),
    };

    try {
      const payload = await collect(db, u.user_id, today, sections);
      const brief = await generateBrief(payload);
      const result = await sendPushToUser(
        db,
        u.user_id,
        "Good morning! Here's your daily brief",
        brief.slice(0, 100) + (brief.length > 100 ? '…' : ''),
        { tab: 'home', fullBrief: brief }
      );
      await logNotification(db, u.user_id, 'daily_brief', result, brief);
      if (result.ok && !result.skipped) sent++;
    } catch (err) {
      await logNotification(db, u.user_id, 'daily_brief', {
        ok: false,
        error: err instanceof Error ? err.message : 'brief error',
      });
    }
  }

  return Response.json({ ok: true, sent });
});
