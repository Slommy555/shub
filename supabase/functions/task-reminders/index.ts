// Supabase Edge Function: task-reminders
//
// pg_cron every minute. For users with task_reminders_enabled: an 8 AM local
// digest of tasks due today, plus a "starting soon" ping one hour before any
// task that has a specific start time. Dedup is via notification_log content
// markers so nothing fires twice in a day.
//
// Deploy:  supabase functions deploy task-reminders
// Secrets: FCM_SERVER_KEY, SUPABASE_SERVICE_ROLE_KEY

import {
  isTimeToSend,
  localDate,
  sendPushToUser,
  serviceClient,
} from '../_shared/push.ts';

/** "HH:MM" minus 60 minutes, clamped to 00:00. */
function minusHour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  let total = h * 60 + m - 60;
  if (total < 0) total = 0;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  const db = serviceClient();

  const { data: users } = await db
    .from('user_preferences')
    .select('user_id, notification_timezone, task_reminders_enabled, notification_enabled')
    .eq('task_reminders_enabled', true)
    .eq('notification_enabled', true);

  let sent = 0;
  for (const u of (users ?? []) as any[]) {
    const tz = u.notification_timezone || 'America/Los_Angeles';
    const today = localDate(tz);

    const { data: tasks } = await db
      .from('tasks')
      .select('text, due_date, scheduled_date, start_time')
      .eq('user_id', u.user_id)
      .eq('done', false);
    const list = (tasks ?? []) as any[];

    // Today's log markers (dedup).
    const { data: logs } = await db
      .from('notification_log')
      .select('content')
      .eq('user_id', u.user_id)
      .eq('type', 'task_reminder')
      .gte('sent_at', `${today}T00:00:00`);
    const seen = new Set((logs ?? []).map((l: any) => l.content));

    // 8 AM digest of tasks due today / overdue.
    if (isTimeToSend('08:00', tz) && !seen.has('digest')) {
      const due = list.filter(
        (t) => (t.due_date && t.due_date <= today) || t.scheduled_date === today
      );
      if (due.length > 0) {
        const body =
          due.length === 1
            ? `Task due today: ${due[0].text}`
            : `${due.length} tasks due today — first: ${due[0].text}`;
        const result = await sendPushToUser(db, u.user_id, 'Tasks due today', body, { tab: 'todo' });
        await db.from('notification_log').insert({
          user_id: u.user_id, type: 'task_reminder',
          status: result.ok ? 'success' : 'failed', error_message: result.error ?? null,
          content: 'digest',
        });
        if (result.ok && !result.skipped) sent++;
      }
    }

    // One hour before a timed task.
    for (const t of list) {
      if (!t.start_time) continue;
      if (t.scheduled_date !== today && t.due_date !== today) continue;
      const marker = `soon:${t.text}:${t.start_time}`;
      if (seen.has(marker)) continue;
      if (isTimeToSend(minusHour(String(t.start_time).slice(0, 5)), tz)) {
        const result = await sendPushToUser(
          db, u.user_id, 'Starting soon', `${t.text} at ${String(t.start_time).slice(0, 5)}`,
          { tab: 'todo' }
        );
        await db.from('notification_log').insert({
          user_id: u.user_id, type: 'task_reminder',
          status: result.ok ? 'success' : 'failed', error_message: result.error ?? null,
          content: marker,
        });
        if (result.ok && !result.skipped) sent++;
      }
    }
  }

  return Response.json({ ok: true, sent });
});
