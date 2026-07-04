// Supabase Edge Function: send-push
//
// Sends a single push notification to a user via FCM. Used by the reminder /
// daily-brief functions and by the app's "Test notification" button.
//
// Deploy:  supabase functions deploy send-push
// Secrets: FCM_SERVICE_ACCOUNT, SUPABASE_SERVICE_ROLE_KEY
//
// Body: { user_id: string, title: string, body: string, data?: object,
//         type?: 'daily_brief'|'task_reminder'|'habit_reminder'|'test' }

import { logNotification, sendPushToUser, serviceClient } from '../_shared/push.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { user_id, title, body, data, type } = await req.json();
    if (!user_id || !title || !body) {
      return Response.json({ error: 'user_id, title and body are required' }, { status: 400 });
    }

    const db = serviceClient();
    const result = await sendPushToUser(db, user_id, title, body, data ?? {});
    await logNotification(db, user_id, type ?? 'test', result);

    return Response.json({ ok: result.ok, skipped: result.skipped ?? false, error: result.error });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'send-push error' },
      { status: 500 }
    );
  }
});
