import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-application-name, x-supabase-auth",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function b64url(input: string) {
  return btoa(input).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hmacSha256(secret: string, data: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return b64url(bin);
}

function getBearerToken(req: Request) {
  const authHeader =
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    "";

  const tokenFromAuth = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  const tokenFromAlt = (req.headers.get("x-supabase-auth") || "").trim();

  return tokenFromAuth || tokenFromAlt || "";
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const MP_CLIENT_ID = Deno.env.get("MP_CLIENT_ID");
    const MP_REDIRECT_URI = Deno.env.get("MP_REDIRECT_URI");
    const MP_STATE_SECRET = Deno.env.get("MP_STATE_SECRET");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Secrets Supabase ausentes" }, 500);
    }

    // 👇 aqui é o ponto que MUITO provavelmente está falhando pra você
    if (!MP_CLIENT_ID || !MP_REDIRECT_URI || !MP_STATE_SECRET) {
      return json(
        {
          error: "Secrets MP ausentes",
          missing: {
            MP_CLIENT_ID: !MP_CLIENT_ID,
            MP_REDIRECT_URI: !MP_REDIRECT_URI,
            MP_STATE_SECRET: !MP_STATE_SECRET,
          },
        },
        500
      );
    }

    // token do usuário (produtor)
    const token = getBearerToken(req);
    if (!token) {
      return json(
        { error: "Missing authorization header (Bearer token não chegou na Edge Function)" },
        401
      );
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return json(
        { error: "Invalid JWT", details: userErr?.message || null },
        401
      );
    }

    const userId = userData.user.id;

    const { data: produtor, error: prodErr } = await sb
      .from("produtores")
      .select("id, plano")
      .eq("user_id", userId)
      .maybeSingle();

    if (prodErr) {
      return json({ error: "Erro ao buscar produtor", details: prodErr.message }, 500);
    }

    if (!produtor?.id) return json({ error: "Produtor não encontrado" }, 404);
    if (produtor.plano === "admin") return json({ error: "Admin não conecta como produtor" }, 403);

    // state assinado (anti-tamper)
    const payload = {
      produtor_id: produtor.id,
      user_id: userId,
      ts: Date.now(),
      nonce: crypto.randomUUID(),
    };

    const payloadStr = JSON.stringify(payload);
    const payloadB64 = b64url(payloadStr);
    const sig = await hmacSha256(MP_STATE_SECRET, payloadB64);
    const state = `${payloadB64}.${sig}`;

    const url =
      `https://auth.mercadopago.com.br/authorization` +
      `?client_id=${encodeURIComponent(MP_CLIENT_ID)}` +
      `&response_type=code` +
      `&platform_id=mp` +
      `&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}` +
      `&state=${encodeURIComponent(state)}`;

    return json({ ok: true, url });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro interno" }, 500);
  }
});
