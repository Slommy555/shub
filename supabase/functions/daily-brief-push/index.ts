// Supabase Edge Function: daily-brief-push
//
// Triggered by pg_cron every minute. For each user with notifications enabled,
// if it's their chosen local time (±1 min) and no brief was sent today, it
// collects the day's data, asks Claude for a concise plain-text brief, sends it
// as a Web Push, and logs the full brief for the in-app bell/modal.
//
// Deploy:  supabase functions deploy daily-brief-push
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

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
  'tasks/events to warrant them. Also look ahead to TOMORROW using the ' +
  '`tomorrow` data (work shift, events): if tomorrow has an early work start or ' +
  'a heavy load, add a short heads-up for tonight (e.g. get to bed early), using ' +
  '`sleep_hours_target` to suggest a target bedtime counted back from ' +
  "tomorrow's start time — keep it to a line and only when it matters. Be " +
  'encouraging and practical, not robotic. End with a short motivational line if it fits.';

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

  const tomorrow = (() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const todayDow = new Date(`${today}T12:00:00`).getDay();
  const tomDow = new Date(`${tomorrow}T12:00:00`).getDay();

  // Recurring work schedule + workout schedule both live on user_preferences.
  const { data: pref } = await db
    .from('user_preferences')
    .select('workout_schedule, work_schedule')
    .eq('user_id', userId)
    .maybeSingle();
  const work = (pref?.work_schedule ?? {}) as {
    workDays?: number[];
    shifts?: Record<string, { start?: string; end?: string }>;
    sleepHours?: number;
  };
  const workDays = Array.isArray(work.workDays) ? work.workDays : [];
  const shiftFor = (dow: number) =>
    workDays.includes(dow) && work.shifts?.[dow]
      ? { start: work.shifts[dow].start, end: work.shifts[dow].end }
      : null;
  const sleepHours = typeof work.sleepHours === 'number' ? work.sleepHours : 8;

  if (sections.tasks || sections.schedule) {
    const { data: tasks } = await db
      .from('tasks')
      .select('text, done, due_date, scheduled_date, start_time, end_time')
      .eq('user_id', userId)
      .eq('done', false);
    const list = (tasks ?? []) as any[];
    const timedOn = (iso: string) =>
      list
        .filter((t) => (t.scheduled_date === iso || t.due_date === iso) && t.start_time)
        .map((t) => ({ text: t.text, start: t.start_time, end: t.end_time }))
        .sort((a, b) => String(a.start).localeCompare(String(b.start)));
    if (sections.tasks) {
      data.tasks_due_or_overdue = list
        .filter((t) => (t.due_date && t.due_date <= today) || t.scheduled_date === today)
        .map((t) => ({ text: t.text, due: t.due_date, overdue: t.due_date && t.due_date < today }));
    }
    if (sections.schedule) {
      data.todays_events = timedOn(today);
      data.today_work_shift = shiftFor(todayDow);
      data.tomorrow = {
        date: tomorrow,
        work_shift: shiftFor(tomDow),
        events: timedOn(tomorrow),
      };
      data.sleep_hours_target = sleepHours;
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
    const sched = (pref?.workout_schedule ?? {}) as Record<string, string>;
    const key = DOW[todayDow];
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

    // Credit card payoff plan: remaining balance + payments due soon / overdue.
    const weekAheadISO = (() => {
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    })();
    const [{ data: cards }, { data: cardPmts }] = await Promise.all([
      db.from('credit_card_payoffs').select('id, name, total_amount').eq('user_id', userId),
      db.from('credit_card_payments').select('payoff_id, due_date, amount, paid').eq('user_id', userId),
    ]);
    const creditCards = ((cards ?? []) as any[])
      .map((c) => {
        const pmts = ((cardPmts ?? []) as any[]).filter((p) => p.payoff_id === c.id);
        const paidSum = pmts.filter((p) => p.paid).reduce((s, p) => s + Number(p.amount || 0), 0);
        const remaining = Math.max(0, Number(c.total_amount || 0) - paidSum);
        const dueThisWeek = pmts
          .filter((p) => !p.paid && p.due_date >= today && p.due_date <= weekAheadISO)
          .map((p) => ({ due: p.due_date, amount: Number(p.amount || 0) }));
        const overdue = pmts
          .filter((p) => !p.paid && p.due_date < today)
          .map((p) => ({ due: p.due_date, amount: Number(p.amount || 0) }));
        return { name: c.name, remaining, due_this_week: dueThisWeek, overdue };
      })
      .filter((c) => c.remaining > 0 || c.due_this_week.length || c.overdue.length);
    if (creditCards.length) data.credit_cards = creditCards;
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
        // Keep the data payload under the Web Push ~4KB limit; the full brief is
        // always available in-app via the bell (notification_log). `type` lets
        // the client open the DailyBriefModal when the notification is tapped.
        { type: 'daily_brief', fullBrief: brief.slice(0, 2500) }
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
