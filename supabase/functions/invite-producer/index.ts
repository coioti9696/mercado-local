// supabase/functions/invite-producer/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  email: string;
  nome_loja: string;
  nome_responsavel: string;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
  plano?: string | null;
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

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

// ✅ Redirect do convite (PRODUÇÃO)
// - Se INVITE_REDIRECT_TO existir em Secrets, usa
// - Se não existir, usa fallback pro seu Vercel
const INVITE_REDIRECT_TO =
  (Deno.env.get("INVITE_REDIRECT_TO") || "").trim() ||
  "https://mercado-local-sepia.vercel.app/convite";

function extractToken(req: Request) {
  // 1) Authorization: Bearer <token>
  const authHeader =
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    "";

  let token = "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    token = authHeader.trim();
  }

  // 2) fallback: x-supabase-auth
  if (!token) {
    token = (req.headers.get("x-supabase-auth") || "").trim();
  }

  // evita token com aspas (alguns clientes podem enviar)
  token = token.replace(/^"+|"+$/g, "").trim();

  return token;
}

serve(async (req) => {
  try {
    // ✅ Preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json({ error: "Método não permitido" }, 405);
    }

    // ✅ PATCH PROFISSIONAL (estável):
    // Use SOMENTE os secrets oficiais que você controla.
    // Não use fallback em SUPABASE_* para não pegar valor errado.
    const SUPABASE_URL = (Deno.env.get("PROJECT_URL") || "").trim();
    const SUPABASE_ANON_KEY = (Deno.env.get("ANON_KEY") || "").trim();
    const SERVICE_ROLE_KEY = (Deno.env.get("SERVICE_ROLE_KEY") || "").trim();

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      return json(
        {
          error:
            "Secrets ausentes. Verifique PROJECT_URL, ANON_KEY e SERVICE_ROLE_KEY em Edge Functions > Secrets.",
        },
        500
      );
    }

    // ✅ extrai token do admin logado
    const token = extractToken(req);
    if (!token) {
      return json({ error: "Missing authorization token" }, 401);
    }

    // ✅ 1) valida o JWT de forma estável (client ANON + Authorization header)
    // Se PROJECT_URL/ANON_KEY estiverem corretos, isso para de dar Invalid JWT.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError || !userData?.user?.id) {
      return json(
        {
          error: "Invalid JWT",
          details: userError?.message || null,
        },
        401
      );
    }

    const adminUserId = userData.user.id;

    // ✅ 2) client admin (service role) para convidar + escrever no banco
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ✅ valida se é admin no seu sistema
    const { data: adminProfile, error: adminProfileError } = await admin
      .from("produtores")
      .select("id, plano")
      .eq("user_id", adminUserId)
      .maybeSingle();

    if (adminProfileError) {
      return json({ error: "Erro ao validar admin" }, 500);
    }

    if (!adminProfile || adminProfile.plano !== "admin") {
      return json({ error: "Sem permissão" }, 403);
    }

    // ✅ Body
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Body inválido (JSON)" }, 400);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const nome_loja = String(body.nome_loja || "").trim();
    const nome_responsavel = String(body.nome_responsavel || "").trim();

    if (!email || !nome_loja || !nome_responsavel) {
      return json({ error: "Campos obrigatórios ausentes" }, 400);
    }

    // ✅ evita duplicidade por email
    const { data: existing, error: existingError } = await admin
      .from("produtores")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      return json({ error: "Erro ao checar duplicidade" }, 500);
    }

    if (existing?.id) {
      return json({ error: "Já existe produtor com esse email" }, 409);
    }

    // ✅ convite no Auth (Supabase envia email)
    const { data: invite, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: INVITE_REDIRECT_TO,
      });

    if (inviteError || !invite?.user?.id) {
      return json(
        { error: inviteError?.message || "Erro ao convidar usuário" },
        400
      );
    }

    // ✅ cria registro em produtores
    const slug = slugify(nome_loja);

    const { error: insertError } = await admin.from("produtores").insert([
      {
        user_id: invite.user.id,
        email,
        nome_loja,
        nome_responsavel,
        telefone: body.telefone || null,
        cidade: body.cidade || null,
        estado: body.estado || null,
        plano: body.plano || "trial",
        slug,
        status_pagamento: "pendente",
        ativo: true,
      },
    ]);

    if (insertError) {
      return json({ error: insertError.message }, 400);
    }

    return json(
      { ok: true, user_id: invite.user.id, redirect_to: INVITE_REDIRECT_TO },
      200
    );
  } catch (err) {
    console.error(err);
    return json({ error: "Erro interno" }, 500);
  }
});
