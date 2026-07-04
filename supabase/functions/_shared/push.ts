// Shared helpers for the push Edge Functions: a service-role Supabase client
// (bypasses RLS to read any user's data server-side) and an FCM sender built on
// the **FCM HTTP v1 API** (the legacy fcm.googleapis.com/fcm/send API is shut
// down). Auth uses a Google service account via a signed-JWT → OAuth2 token
// exchange (Web Crypto, no external libraries).
//
// Secrets required (supabase secrets set ...):
//   FCM_SERVICE_ACCOUNT          — the full service-account JSON (one line)
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

// --- Google service-account OAuth (for FCM HTTP v1) ------------------------

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
}

function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Cache the access token across invocations while the isolate lives.
let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - now > 60) return cachedToken.token;

  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const signingInput = `${header}.${claim}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  );
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch(sa.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`OAuth token error: ${JSON.stringify(json).slice(0, 200)}`);
  }
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.token;
}

/**
 * Send a push to one user via their stored FCM token (FCM HTTP v1 API).
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
  const sa = serviceAccount();
  if (!sa) return { ok: false, error: 'FCM_SERVICE_ACCOUNT not set or invalid JSON' };

  const { data: pref, error } = await db
    .from('user_preferences')
    .select('fcm_token')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const token = pref?.fcm_token as string | undefined;
  if (!token) return { ok: true, skipped: true };

  // FCM v1 data values must be strings.
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'OAuth failed' };
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: stringData,
          android: { notification: { icon: 'ic_notification' } },
        },
      }),
    }
  );

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
