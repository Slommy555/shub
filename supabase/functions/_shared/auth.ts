// Shared auth + CORS helpers for the Edge Functions.
//
// Every proxied call (Anthropic, USDA) spends a paid, server-side key, so each
// function must independently:
//   1. Verify the caller presents a valid Supabase session JWT (else 401).
//   2. Confirm the authenticated email is the single allowed user (else 403).
//   3. Only answer requests from the app's own origin(s) (CORS allowlist).
//
// Do NOT rely on the platform's implicit `verify_jwt` gateway alone — a single
// `--no-verify-jwt` deploy would otherwise leave the key wide open to abuse.
//
// Required secrets (set with `supabase secrets set ...`):
//   ALLOWED_EMAIL   the one email permitted to use the app
//   ALLOWED_ORIGIN  comma-separated origin allowlist (e.g.
//                   "https://your-app.vercel.app,http://localhost:5173")
// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically by the runtime.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGIN') ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** CORS headers locked to the configured app origin(s). */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

/** JSON response helper that always carries the right CORS headers. */
export function json(req: Request, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'content-type': 'application/json' },
  });
}

export type AuthResult =
  | { ok: true; email: string }
  | { ok: false; response: Response };

/**
 * Verify the Supabase JWT on the request and enforce the single-user email
 * whitelist. Returns the authenticated email on success, or a ready-to-send
 * 401/403/500 Response on failure.
 */
export async function requireAllowedUser(req: Request): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const allowedEmail = Deno.env.get('ALLOWED_EMAIL');

  if (!supabaseUrl || !anonKey) {
    return { ok: false, response: json(req, { error: 'Server auth is not configured.' }, 500) };
  }
  if (!allowedEmail) {
    return { ok: false, response: json(req, { error: 'ALLOWED_EMAIL secret is not set.' }, 500) };
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { ok: false, response: json(req, { error: 'Missing authorization token.' }, 401) };
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, response: json(req, { error: 'Invalid or expired session.' }, 401) };
  }

  const email = data.user.email ?? '';
  if (email.toLowerCase() !== allowedEmail.toLowerCase()) {
    return { ok: false, response: json(req, { error: 'This account is not authorized.' }, 403) };
  }

  return { ok: true, email };
}
