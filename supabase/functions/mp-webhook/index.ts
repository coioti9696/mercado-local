// supabase/functions/mp-webhook/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-application-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function mapMpToLocalStatus(mpStatus?: string, mpDetail?: string) {
  const s = String(mpStatus || "").toLowerCase();
  const d = String(mpDetail || "").toLowerCase();

  // ✅ aprovado
  if (s === "approved") return "pago";

  // ✅ pendente/em processamento
  if (s === "pending" || s === "in_process") return "pendente";

  // ✅ cancelado / rejeitado / estornado
  if (s === "cancelled" || s === "rejected" || s === "refunded" || s === "charged_back") {
    return "cancelado";
  }

  // ✅ expirado (às vezes vem em status_detail)
  if (s === "expired" || d.includes("expired")) return "expirado";

  // fallback
  return "pendente";
}

Deno.serve(async (req) => {
  try {
    // ✅ CORS preflight
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // MP às vezes pode bater com GET (teste), então respondemos OK
    if (req.method === "GET") return json({ ok: true });

    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const MP_ACCESS_TOKEN_FALLBACK = Deno.env.get("MP_ACCESS_TOKEN") || null;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Secrets ausentes (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" }, 500);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ✅ Lê corpo bruto e parseia
    const raw = await req.text();
    const body = safeJsonParse(raw) || {};

    // ✅ Mercado Pago geralmente manda:
    // { type: "payment", data: { id: "123" }, ... }
    // ou às vezes vem query param ?data.id=123
    const url = new URL(req.url);
    const paymentIdFromBody =
      body?.data?.id ??
      body?.data_id ??
      body?.id ??
      null;

    const paymentIdFromQuery =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      null;

    const paymentId = String(paymentIdFromBody || paymentIdFromQuery || "").trim();

    if (!paymentId) {
      // ✅ Não quebra: responde 200 para não ficar em loop de retry
      console.warn("MP webhook sem payment id. Body:", body);
      return json({ ok: true, ignored: true });
    }

    // ✅ 1) tentar encontrar pedido pelo payment_id / id_pagamento
    const { data: pedido, error: pedidoErr } = await sb
      .from("pedidos")
      .select("id, produtor_id, payment_id, id_pagamento, status, status_pagamento")
      .or(`payment_id.eq.${paymentId},id_pagamento.eq.${paymentId}`)
      .limit(1)
      .maybeSingle();

    if (pedidoErr) {
      console.error("Erro ao buscar pedido:", pedidoErr);
      return json({ ok: true }); // responde OK pro MP não ficar tentando
    }

    if (!pedido) {
      // Ainda assim, buscamos o pagamento e só não atualizamos nada
      console.warn("Nenhum pedido encontrado para paymentId:", paymentId);
      return json({ ok: true, not_found: true });
    }

    // ✅ 2) pega token do MP certo (do produtor se conectado; senão fallback)
    const { data: produtor, error: prodErr } = await sb
      .from("produtores")
      .select("id, mp_connected, mp_access_token")
      .eq("id", pedido.produtor_id)
      .maybeSingle();

    if (prodErr) console.error("Erro ao buscar produtor:", prodErr);

    const mpToken =
      (produtor?.mp_connected && produtor?.mp_access_token)
        ? produtor.mp_access_token
        : MP_ACCESS_TOKEN_FALLBACK;

    if (!mpToken) {
      console.error("Sem MP token (produtor não conectado e sem fallback). paymentId:", paymentId);
      return json({ ok: true }); // responde OK pro MP não retry infinito
    }

    // ✅ 3) busca o pagamento real no Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
    });

    const mpText = await mpRes.text();
    const mp = safeJsonParse(mpText) || {};

    if (!mpRes.ok) {
      console.error("Falha ao consultar pagamento no MP:", mpRes.status, mp);
      return json({ ok: true }); // responde OK pro MP
    }

    const mpStatus = mp?.status;
    const mpDetail = mp?.status_detail;

    const novoStatusPagamento = mapMpToLocalStatus(mpStatus, mpDetail);

    // ✅ pega dados de PIX se tiver
    const qrCode = mp?.point_of_interaction?.transaction_data?.qr_code ?? null;
    const qrBase64 = mp?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    const mpExpiresAt = mp?.date_of_expiration ?? null;

    // ✅ 4) atualiza pedido no seu banco
    const updatePayload: Record<string, unknown> = {
      payment_provider: "mercadopago",
      payment_id: String(mp?.id ?? paymentId),
      id_pagamento: String(mp?.id ?? paymentId), // compat
      status_pagamento: novoStatusPagamento,
      updated_at: new Date().toISOString(),
    };

    if (qrCode) updatePayload.pix_qr_code = qrCode;
    if (qrBase64) updatePayload.pix_qr_code_base64 = qrBase64;
    if (mpExpiresAt) updatePayload.pix_expires_at = mpExpiresAt;

    // ✅ regra: quando aprovado -> confirma o pedido automaticamente
    if (novoStatusPagamento === "pago") {
      updatePayload.status = "confirmado";
    }

    const { error: updErr } = await sb
      .from("pedidos")
      .update(updatePayload)
      .eq("id", pedido.id);

    if (updErr) {
      console.error("Erro ao atualizar pedido:", updErr);
      return json({ ok: true }); // responde OK mesmo assim
    }

    return json({ ok: true });
  } catch (err) {
    console.error("Webhook erro interno:", err);
    // ✅ responde OK pra evitar flood de retries
    return json({ ok: true });
  }
});
