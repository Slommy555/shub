// Lift: sends a magic link only to emails listed in the ALLOWED_EMAIL secret
// (comma-separated allowed). Deployed with --no-verify-jwt since callers are
// signed out by definition.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let email = "";
  let redirectTo: string | undefined;
  try {
    const body = await req.json();
    email = String(body.email ?? "").trim().toLowerCase();
    redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  const allowed = (Deno.env.get("ALLOWED_EMAIL") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!email || !allowed.includes(email)) {
    return json({ error: "This email is not allowed." }, 403);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    // implicit flow: a PKCE verifier would be stranded on this server
    { auth: { persistSession: false, flowType: "implicit" } },
  );
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
});
