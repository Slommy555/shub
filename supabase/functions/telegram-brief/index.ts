// Supabase Edge Function: telegram-brief
//
// Triggered by pg_cron every minute (see 025_telegram_cron.sql). For each user
// with telegram_enabled = true, if it's their chosen local delivery time (±1 min)
// and no brief was sent today, it collects the day's data (per telegram_sections),
// asks Claude to write a warm, Telegram-formatted brief, sends it to Telegram,
// and logs the result to telegram_brief_log.
//
// The app does NOT need to be open — this runs entirely server-side.
//
// Deploy:  supabase functions deploy telegram-brief
// Secrets: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
//          TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
//   (SUPABASE_URL is provided automatically in the Edge runtime.)
//
// SECURITY: all user data is read with the service role key; the brief is only
// ever sent to the single TELEGRAM_CHAT_ID stored in secrets — never to a value
// supplied by a client. The function has no side effects for a non-authorized
// caller (it only reads prefs and posts to the fixed chat), and is intended to
// be invoked by pg_cron.

import { isTimeToSend, localDate, serviceClient } from '../_shared/push.ts';
// deno-lint-ignore no-explicit-any
type Any = any;

// This function is safe to call from any origin: it requires a valid Supabase
// JWT (verify_jwt) and only ever sends to the single TELEGRAM_CHAT_ID secret —
// it can't be abused to spend a key or message an arbitrary target. So, unlike
// anthropic-proxy, we echo the caller's origin rather than locking to an
// ALLOWED_ORIGIN allowlist (which was silently blocking the in-app test button
// whenever the app was served from an origin not in that list).
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'content-type': 'application/json' },
  });
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');
const MODEL = 'claude-sonnet-4-6';
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TELEGRAM_LIMIT = 4096;

const SYSTEM_PROMPT =
  'You are a personal daily briefing assistant sending a morning message via ' +
  'Telegram. Generate a friendly, well-structured daily brief based on the ' +
  "user's data. Adapt length to how much is happening — light day = short and " +
  'punchy, busy day = thorough. Use Telegram markdown: *bold* for section ' +
  'headers, • for bullet points, _italic_ for emphasis. Do NOT use # headers — ' +
  "Telegram doesn't render them. Include time management recommendations only " +
  'if the schedule/task load warrants it. If the budget section shows ' +
  'overspending or categories near limits, give a brief practical suggestion ' +
  "for the day's spending. " +
  'Also look ahead to TOMORROW using the `tomorrow` data (work shift, events) ' +
  'and connect it to today: if tomorrow has an early work start or a heavy load, ' +
  'add a short, practical heads-up for tonight — e.g. wind down and get to bed ' +
  'early. Use `sleep_hours_target` to suggest a concrete target bedtime (count ' +
  "back that many hours from tomorrow's start time), but keep it to a line or " +
  'two and only when it actually matters. ' +
  "End with one short motivational line tailored to what's ahead. Be warm and " +
  'direct, not robotic.';

interface Sections {
  schedule: boolean;
  tasks: boolean;
  habits: boolean;
  workout: boolean;
  budget: boolean;
  notes: boolean;
  recommendations: boolean;
}

/** Flatten a Tiptap doc to plain text (best-effort) for note snippets. */
function tiptapText(content: unknown): string {
  try {
    const walk = (n: Any): string => {
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

async function collect(db: Any, userId: string, today: string, sections: Sections) {
  const data: Record<string, unknown> = {};

  // Tomorrow (local), for the look-ahead / sleep guidance.
  const tomorrow = (() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const todayDow = new Date(`${today}T12:00:00`).getDay();
  const tomDow = new Date(`${tomorrow}T12:00:00`).getDay();

  // The recurring WORK schedule and the workout schedule both live on the
  // user_preferences row (work_schedule syncs from the app's localStorage).
  const { data: pref } = await db
    .from('user_preferences')
    .select('workout_schedule, work_schedule')
    .eq('user_id', userId)
    .maybeSingle();

  const work = (pref?.work_schedule ?? {}) as {
    workDays?: number[];
    shifts?: Record<string, { start?: string; end?: string; notes?: string }>;
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
    const list = (tasks ?? []) as Any[];
    const timedOn = (iso: string) =>
      list
        .filter((t) => (t.scheduled_date === iso || t.due_date === iso) && t.start_time)
        .map((t) => ({ text: t.text, start: t.start_time, end: t.end_time }))
        .sort((a, b) => String(a.start).localeCompare(String(b.start)));
    if (sections.schedule) {
      data.todays_events = timedOn(today);
      data.today_work_shift = shiftFor(todayDow);
      // Look-ahead: what's on tomorrow, so the brief can advise on tonight.
      data.tomorrow = {
        date: tomorrow,
        weekday: WEEKDAY_NAMES[tomDow],
        work_shift: shiftFor(tomDow),
        events: timedOn(tomorrow),
      };
      data.sleep_hours_target = sleepHours;
    }
    if (sections.tasks) {
      data.tasks_due_or_overdue = list
        .filter((t) => (t.due_date && t.due_date <= today) || t.scheduled_date === today)
        .map((t) => ({ text: t.text, due: t.due_date, overdue: t.due_date && t.due_date < today }));
    }
  }

  if (sections.habits) {
    const { data: habits } = await db
      .from('habits')
      .select('id, name')
      .eq('user_id', userId)
      .eq('archived', false);
    const { data: logs } = await db.from('habit_logs').select('habit_id').eq('date', today);
    const done = new Set((logs ?? []).map((l: Any) => l.habit_id));
    data.habits = (habits ?? []).map((h: Any) => ({ name: h.name, done: done.has(h.id) }));
  }

  if (sections.workout) {
    const sched = (pref?.workout_schedule ?? {}) as Record<string, string>;
    const key = DOW[todayDow];
    data.workout_today = sched[key] || 'Rest Day';
    data.workout_tomorrow = sched[DOW[tomDow]] || 'Rest Day';
  }

  if (sections.budget) {
    const monthStart = today.slice(0, 7) + '-01';
    const weekStart = (() => {
      const d = new Date(`${today}T12:00:00`);
      const diff = (d.getDay() + 6) % 7; // days since Monday
      d.setDate(d.getDate() - diff);
      return d.toISOString().slice(0, 10);
    })();
    const [{ data: txs }, { data: cats }] = await Promise.all([
      db.from('budget_transactions').select('type, amount, date, category_id').eq('user_id', userId).gte('date', monthStart),
      db.from('budget_categories').select('id, name, monthly_limit').eq('user_id', userId),
    ]);
    const list = (txs ?? []) as Any[];
    const catById = new Map((cats ?? []).map((c: Any) => [c.id, c]));
    const spentToday = list
      .filter((t) => t.type === 'expense' && t.date === today)
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const spentWeek = list
      .filter((t) => t.type === 'expense' && t.date >= weekStart)
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const spentMonth = list
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    // Categories at/over their monthly limit.
    const perCat = new Map<string, number>();
    for (const t of list) {
      if (t.type !== 'expense' || !t.category_id) continue;
      perCat.set(t.category_id, (perCat.get(t.category_id) ?? 0) + Number(t.amount || 0));
    }
    const overLimit: { name: string; spent: number; limit: number }[] = [];
    for (const [id, spent] of perCat) {
      const c = catById.get(id) as Any;
      if (c?.monthly_limit && spent >= Number(c.monthly_limit) * 0.9) {
        overLimit.push({ name: c.name, spent, limit: Number(c.monthly_limit) });
      }
    }
    data.budget = {
      spent_today: spentToday,
      spent_this_week: spentWeek,
      spent_this_month: spentMonth,
      categories_near_or_over_limit: overLimit,
    };

    // Credit card payoff plan: remaining balance per card, plus any payments due
    // in the next 7 days or already overdue (so the brief can nudge the user).
    const weekAheadISO = (() => {
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    })();
    const [{ data: cards }, { data: cardPmts }] = await Promise.all([
      db.from('credit_card_payoffs').select('id, name, total_amount').eq('user_id', userId),
      db.from('credit_card_payments').select('payoff_id, due_date, amount, paid').eq('user_id', userId),
    ]);
    const creditCards = ((cards ?? []) as Any[])
      .map((c) => {
        const pmts = ((cardPmts ?? []) as Any[]).filter((p) => p.payoff_id === c.id);
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
    data.flagged_notes = (notes ?? []).map((n: Any) => ({
      title: n.title,
      content: tiptapText(n.content).slice(0, 1000),
    }));
  }

  data.include_time_management_recommendations = sections.recommendations;
  data.date = today;
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
      max_tokens: 1500,
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

/** Split a message into <=4096-char chunks, preferring paragraph/line breaks. */
function splitMessage(text: string, limit = TELEGRAM_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n\n', limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf('\n', limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf(' ', limit);
    if (cut <= 0) cut = limit;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Send a (possibly multi-part) brief to the fixed Telegram chat. */
async function sendToTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set' };
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const parts = splitMessage(text);
  for (let i = 0; i < parts.length; i++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: parts[i], parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Telegram ${res.status}: ${body}`.slice(0, 300) };
    }
    if (i < parts.length - 1) await sleep(500);
  }
  return { ok: true };
}

async function logResult(
  db: Any,
  userId: string,
  status: 'success' | 'failed',
  content: string | null,
  error: string | null
) {
  await db.from('telegram_brief_log').insert({
    user_id: userId,
    status,
    error_message: error,
    content,
    char_count: content ? content.length : null,
  });
}

const SELECT_COLS = 'user_id, telegram_time, telegram_timezone, telegram_sections';

/** Build + send one user's brief. `force` skips the time/once-a-day gates. */
async function runForUser(db: Any, u: Any, force: boolean): Promise<boolean> {
  const tz = u.telegram_timezone || 'America/Los_Angeles';
  if (!force && !isTimeToSend(u.telegram_time || '07:00', tz)) return false;

  const today = localDate(tz);
  if (!force) {
    const { data: existing } = await db
      .from('telegram_brief_log')
      .select('id')
      .eq('user_id', u.user_id)
      .eq('status', 'success')
      .gte('sent_at', `${today}T00:00:00`)
      .limit(1);
    if (existing && existing.length > 0) return false;
  }

  const sections: Sections = {
    schedule: true, tasks: true, habits: true, workout: true, budget: true, notes: true, recommendations: true,
    ...(u.telegram_sections ?? {}),
  };

  try {
    const payload = await collect(db, u.user_id, today, sections);
    const brief = await generateBrief(payload);
    const result = await sendToTelegram(brief);
    await logResult(db, u.user_id, result.ok ? 'success' : 'failed', brief, result.error ?? null);
    return result.ok;
  } catch (err) {
    await logResult(db, u.user_id, 'failed', null, err instanceof Error ? err.message : 'brief error');
    return false;
  }
}

Deno.serve(async (req: Request) => {
  // Browser preflight (the in-app "Send test" button) needs CORS headers, or the
  // request never leaves the browser ("failed to send a request to the function").
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  const db = serviceClient();

  // Optional body: { force?: true, user_id?: string } — the in-app "Send test"
  // button posts this to deliver immediately, bypassing the time/dedup gates and
  // the telegram_enabled filter (so a user can test before turning it on). The
  // brief itself is built identically to a scheduled send (same runForUser).
  let force = false;
  let forcedUserId: string | null = null;
  try {
    const body = await req.json();
    force = body?.force === true;
    forcedUserId = typeof body?.user_id === 'string' ? body.user_id : null;
  } catch {
    /* no body / not JSON — scheduled run */
  }

  if (force && forcedUserId) {
    const { data: u } = await db
      .from('user_preferences')
      .select(SELECT_COLS)
      .eq('user_id', forcedUserId)
      .maybeSingle();
    if (!u) return json(req, { ok: false, error: 'No preferences found for this user.' }, 404);
    const ok = await runForUser(db, u, true);
    // Surface the send failure reason (e.g. a Telegram API error) to the button.
    const err = ok ? null : await lastError(db, forcedUserId);
    return json(req, { ok, sent: ok ? 1 : 0, error: err }, 200);
  }

  const { data: users } = await db
    .from('user_preferences')
    .select(SELECT_COLS)
    .eq('telegram_enabled', true);

  let sent = 0;
  for (const u of (users ?? []) as Any[]) {
    if (await runForUser(db, u, false)) sent++;
  }
  return json(req, { ok: true, sent }, 200);
});

/** The most recent failure reason logged for a user (for the test button). */
async function lastError(db: Any, userId: string): Promise<string | null> {
  const { data } = await db
    .from('telegram_brief_log')
    .select('error_message')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(1);
  return (data && data[0]?.error_message) || null;
}
