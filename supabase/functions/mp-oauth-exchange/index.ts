import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-application-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function b64urlToStr(b64url: string) {
  const b64 = b64url.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((b64url.length + 3) % 4);
  return atob(b64);
}

async function hmacSha256(secret: string, data: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

type Body = { code: string; state: string };

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const MP_CLIENT_ID = Deno.env.get("MP_CLIENT_ID");
    const MP_CLIENT_SECRET = Deno.env.get("MP_CLIENT_SECRET");
    const MP_REDIRECT_URI = Deno.env.get("MP_REDIRECT_URI");
    const MP_STATE_SECRET = Deno.env.get("MP_STATE_SECRET");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Secrets Supabase ausentes" }, 500);
    if (!MP_CLIENT_ID || !MP_CLIENT_SECRET || !MP_REDIRECT_URI || !MP_STATE_SECRET) return json({ error: "Secrets MP ausentes" }, 500);

    // valida sessão do usuário também (segurança extra)
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : auth.trim();
    if (!token) return json({ error: "Missing authorization header" }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "Invalid JWT" }, 401);
    const sessionUserId = userData.user.id;

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Body inválido" }, 400);
    }

    const code = String(body.code || "").trim();
    const state = String(body.state || "").trim();
    if (!code || !state) return json({ error: "code/state obrigatórios" }, 400);

    const [payloadB64, sig] = state.split(".");
    if (!payloadB64 || !sig) return json({ error: "state inválido" }, 400);

    const expectedSig = await hmacSha256(MP_STATE_SECRET, payloadB64);
    if (sig !== expectedSig) return json({ error: "state inválido (assinatura)" }, 400);

    const payload = JSON.parse(b64urlToStr(payloadB64));
    const produtorId = String(payload?.produtor_id || "");
    const userIdFromState = String(payload?.user_id || "");
    const ts = Number(payload?.ts || 0);

    if (!produtorId || !userIdFromState || !ts) return json({ error: "state inválido (campos)" }, 400);

    // expira em 10 min
    if (Date.now() - ts > 10 * 60 * 1000) return json({ error: "state expirado" }, 400);

    // garante que o usuário atual é o mesmo do state
    if (sessionUserId !== userIdFromState) return json({ error: "Sessão não corresponde ao state" }, 403);

    // troca code por token
    const form = new URLSearchParams();
    form.set("grant_type", "authorization_code");
    form.set("client_id", MP_CLIENT_ID);
    form.set("client_secret", MP_CLIENT_SECRET);
    form.set("code", code);
    form.set("redirect_uri", MP_REDIRECT_URI);

    const mpRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const mpJson = await mpRes.json().catch(() => ({}));
    if (!mpRes.ok) {
      console.error("MP oauth error:", mpRes.status, mpJson);
      return json({ error: "Falha ao conectar Mercado Pago", details: mpJson }, 400);
    }

    const accessToken = String(mpJson.access_token || "");
    const refreshToken = String(mpJson.refresh_token || "");
    const mpUserId = mpJson.user_id ? String(mpJson.user_id) : null;
    const expiresIn = Number(mpJson.expires_in || 0);

    if (!accessToken || !refreshToken) return json({ error: "MP não retornou tokens" }, 400);

    const expiresAt = new Date(Date.now() + Math.max(60, expiresIn) * 1000).toISOString();

    // salva tokens no produtor
    const { error: updErr } = await sb
      .from("produtores")
      .update({
        mp_connected: true,
        mp_user_id: mpUserId,
        mp_access_token: accessToken,
        mp_refresh_token: refreshToken,
        mp_token_expires_at: expiresAt,
      })
      .eq("id", produtorId)
      .eq("user_id", sessionUserId);

    if (updErr) {
      console.error(updErr);
      return json({ error: "Falha ao salvar tokens no produtor" }, 500);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    console.error(e);
    return json({ error: "Erro interno" }, 500);
  }
});
