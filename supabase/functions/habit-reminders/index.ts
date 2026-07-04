// Supabase Edge Function: habit-reminders
//
// pg_cron every minute. For each habit that has a reminder_time, if it's that
// time in the owner's timezone (±1 min) and it wasn't already sent today, send
// a push. Dedup via a per-habit notification_log content marker.
//
// Deploy:  supabase functions deploy habit-reminders
// Secrets: FCM_SERVER_KEY, SUPABASE_SERVICE_ROLE_KEY

import {
  isTimeToSend,
  localDate,
  sendPushToUser,
  serviceClient,
} from '../_shared/push.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  const db = serviceClient();

  // Habits that have a reminder set.
  const { data: habits } = await db
    .from('habits')
    .select('id, user_id, name, reminder_time')
    .eq('archived', false)
    .not('reminder_time', 'is', null);
  if (!habits || habits.length === 0) return Response.json({ ok: true, sent: 0 });

  // Timezone + master toggle per user (one fetch, then map).
  const userIds = [...new Set((habits as any[]).map((h) => h.user_id))];
  const { data: prefs } = await db
    .from('user_preferences')
    .select('user_id, notification_timezone, notification_enabled')
    .in('user_id', userIds);
  const prefMap = new Map((prefs ?? []).map((p: any) => [p.user_id, p]));

  let sent = 0;
  for (const h of habits as any[]) {
    const pref = prefMap.get(h.user_id);
    if (!pref || !pref.notification_enabled) continue;
    const tz = pref.notification_timezone || 'America/Los_Angeles';
    if (!isTimeToSend(String(h.reminder_time).slice(0, 5), tz)) continue;

    const today = localDate(tz);
    const marker = `habit:${h.id}`;
    const { data: logs } = await db
      .from('notification_log')
      .select('id')
      .eq('user_id', h.user_id)
      .eq('type', 'habit_reminder')
      .eq('content', marker)
      .gte('sent_at', `${today}T00:00:00`)
      .limit(1);
    if (logs && logs.length > 0) continue;

    const result = await sendPushToUser(
      db, h.user_id, 'Habit reminder', h.name, { tab: 'productivity' }
    );
    await db.from('notification_log').insert({
      user_id: h.user_id, type: 'habit_reminder',
      status: result.ok ? 'success' : 'failed', error_message: result.error ?? null,
      content: marker,
    });
    if (result.ok && !result.skipped) sent++;
  }

  return Response.json({ ok: true, sent });
});
