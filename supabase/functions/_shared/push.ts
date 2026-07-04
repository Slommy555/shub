// Shared helpers for the push Edge Functions: a service-role Supabase client
// (bypasses RLS to read any user's data server-side) and a Web Push sender built
// on the standard Web Push Protocol with VAPID (no Firebase/FCM). Works in
// Chrome (desktop + Android) and Safari/iOS 16.4+ installed as a PWA.
//
// Secrets required (supabase secrets set ...):
//   VAPID_PUBLIC_KEY             — VAPID public key (also exposed to the client)
//   VAPID_PRIVATE_KEY            — VAPID private key (server only)
//   VAPID_EMAIL                  — contact, e.g. mailto:you@example.com
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (never exposed to frontend)
// SUPABASE_URL is provided automatically in the Edge runtime.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

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

// --- VAPID setup -----------------------------------------------------------

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const email = Deno.env.get('VAPID_EMAIL') ?? 'mailto:admin@example.com';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(email, publicKey, privateKey);
  vapidReady = true;
  return true;
}

/**
 * Send a push to one user via their stored Web Push subscription (VAPID).
 * Skips silently when the user has no subscription. If the subscription is
 * gone (404/410), it is cleared so we stop trying. Returns the outcome so
 * callers can log it.
 */
export async function sendPushToUser(
  db: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<PushResult> {
  if (!ensureVapid()) {
    return { ok: false, error: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set' };
  }

  const { data: pref, error } = await db
    .from('user_preferences')
    .select('push_subscription')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const raw = pref?.push_subscription as string | undefined;
  if (!raw) return { ok: true, skipped: true };

  let subscription: unknown;
  try {
    subscription = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'stored push_subscription is not valid JSON' };
  }

  const payload = JSON.stringify({ title, body, data });

  try {
    // deno-lint-ignore no-explicit-any
    await webpush.sendNotification(subscription as any, payload);
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    // 404 = endpoint gone, 410 = subscription expired → drop it.
    if (status === 404 || status === 410) {
      await db
        .from('user_preferences')
        .update({ push_subscription: null })
        .eq('user_id', userId);
      return { ok: false, error: `subscription expired (${status}), cleared` };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `web-push ${status ?? ''}: ${msg}`.slice(0, 200) };
  }
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
    char_count: content ? content.length : null,
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
