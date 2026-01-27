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

// ✅ Centralize aqui o redirect do convite.
const INVITE_REDIRECT_TO = "http://localhost:8080/convite";

serve(async (req) => {
  try {
    // ✅ Preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json({ error: "Método não permitido" }, 405);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(
        { error: "Secrets ausentes (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
        500
      );
    }

    if (!SUPABASE_ANON_KEY) {
      return json(
        { error: "Secret ausente: SUPABASE_ANON_KEY (necessário para fallback JWT)" },
        500
      );
    }

    // ✅ Client com Service Role (poder total)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ✅ Token do usuário logado (admin) pode vir de Authorization OU x-supabase-auth
    const authHeader =
      req.headers.get("authorization") ||
      req.headers.get("Authorization") ||
      "";

    const tokenFromAuth = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    const tokenFromAlt = (req.headers.get("x-supabase-auth") || "").trim();
    const token = tokenFromAuth || tokenFromAlt;

    if (!token) {
      return json({ error: "Missing authorization header" }, 401);
    }

    // ✅ 1) Tenta validar JWT com service role
    let adminUserId: string | null = null;

    const { data: userData, error: userError } = await admin.auth.getUser(token);

    if (!userError && userData?.user?.id) {
      adminUserId = userData.user.id;
    } else {
      // ✅ 2) Fallback: valida JWT via client token-based com ANON KEY (mais estável em alguns casos)
      const tokenClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: fallbackData, error: fallbackError } =
        await tokenClient.auth.getUser();

      if (fallbackError || !fallbackData?.user?.id) {
        // retorna erro mais informativo (sem vazar token)
        return json(
          {
            error: "Invalid JWT",
            details: fallbackError?.message || userError?.message || null,
          },
          401
        );
      }

      adminUserId = fallbackData.user.id;
    }

    if (!adminUserId) {
      return json({ error: "Invalid JWT" }, 401);
    }

    // ✅ Verifica se é admin no seu sistema (plano === "admin")
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

    return json({ ok: true, user_id: invite.user.id }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "Erro interno" }, 500);
  }
});
