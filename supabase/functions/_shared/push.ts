// Shared helpers for the push Edge Functions: a service-role Supabase client
// (bypasses RLS to read any user's data server-side) and an FCM sender.
//
// Secrets required (supabase secrets set ...):
//   FCM_SERVER_KEY               — Firebase Cloud Messaging legacy server key
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (never exposed to frontend)
// SUPABASE_URL is provided automatically in the Edge runtime.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface PushResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Send a push to one user via their stored FCM token (Firebase legacy HTTP API).
 * Skips silently when the user has no token. Returns the outcome so callers can
 * log it.
 */
export async function sendPushToUser(
  db: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<PushResult> {
  const serverKey = Deno.env.get('FCM_SERVER_KEY');
  if (!serverKey) return { ok: false, error: 'FCM_SERVER_KEY not set' };

  const { data: pref, error } = await db
    .from('user_preferences')
    .select('fcm_token')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const token = pref?.fcm_token as string | undefined;
  if (!token) return { ok: true, skipped: true };

  // FCM data payload values must be strings.
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }

  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      Authorization: `key=${serverKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      notification: { title, body, icon: 'ic_notification' },
      data: stringData,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `FCM ${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

/** Log a notification attempt (service role bypasses RLS). */
export async function logNotification(
  db: SupabaseClient,
  userId: string,
  type: 'daily_brief' | 'task_reminder' | 'habit_reminder' | 'test',
  result: PushResult,
  content?: string
): Promise<void> {
  await db.from('notification_log').insert({
    user_id: userId,
    type,
    status: result.ok ? 'success' : 'failed',
    error_message: result.error ?? null,
    content: content ?? null,
  });
}

/** True when the user's local wall-clock time matches HH:MM (±1 min). */
export function isTimeToSend(timeStr: string, timezone: string): boolean {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '-1');
    const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '-1');
    const [th, tm] = timeStr.split(':').map(Number);
    const nowMin = hh * 60 + mm;
    const target = th * 60 + tm;
    return Math.abs(nowMin - target) <= 1;
  } catch {
    return false;
  }
}

/** Local YYYY-MM-DD for a timezone (for "already sent today" checks). */
export function localDate(timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
