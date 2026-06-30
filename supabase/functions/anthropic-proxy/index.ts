// Supabase Edge Function: anthropic-proxy
//
// Proxies a Messages API call to Anthropic so the API key stays server-side.
// Each request is independently authenticated: a valid Supabase JWT is required
// (401 otherwise) AND the authenticated email must match ALLOWED_EMAIL (403
// otherwise). CORS is restricted to the app's own origin(s).
//
// Deploy:
//   supabase functions deploy anthropic-proxy
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase secrets set ALLOWED_EMAIL=you@example.com
//   supabase secrets set ALLOWED_ORIGIN=https://your-app.vercel.app,http://localhost:5173
//
// Body: { system: string, messages: {role,content}[], model?: string, max_tokens?: number }
// Returns: the raw Anthropic Messages response JSON.

import { corsHeaders, json, requireAllowedUser } from '../_shared/auth.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const DEFAULT_MODEL = 'claude-sonnet-4-6';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  // Reject anyone who isn't the authenticated, whitelisted user before doing
  // anything that could spend the API key.
  const auth = await requireAllowedUser(req);
  if (!auth.ok) return auth.response;

  if (!ANTHROPIC_API_KEY) {
    return json(req, { error: 'ANTHROPIC_API_KEY secret is not set.' }, 500);
  }

  try {
    const { system, messages, model, max_tokens } = await req.json();
    if (!Array.isArray(messages)) {
      return json(req, { error: 'messages array is required.' }, 400);
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model ?? DEFAULT_MODEL,
        max_tokens: max_tokens ?? 2000,
        system,
        messages,
      }),
    });

    const data = await res.json();
    return json(req, data, res.status);
  } catch (err) {
    return json(req, { error: err instanceof Error ? err.message : 'Proxy error' }, 500);
  }
});
