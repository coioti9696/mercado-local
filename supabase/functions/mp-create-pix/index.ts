// supabase/functions/mp-create-pix/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  pedido_id: string;
  produtor_id: string;
  numero_pedido?: string;
  total?: number;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-application-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const MP_ACCESS_TOKEN_FALLBACK = Deno.env.get("MP_ACCESS_TOKEN") || null;
    const MP_WEBHOOK_URL = Deno.env.get("MP_WEBHOOK_URL") || null;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Secrets ausentes (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" }, 500);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Body inválido (JSON)" }, 400);
    }

    const pedido_id = String(body.pedido_id || "").trim();
    const produtor_id = String(body.produtor_id || "").trim();
    const numero_pedido = body.numero_pedido ? String(body.numero_pedido).trim() : null;

    if (!pedido_id || !produtor_id) {
      return json({ error: "Campos obrigatórios ausentes: pedido_id, produtor_id" }, 400);
    }

    const { data: pedido, error: pedidoErr } = await sb
      .from("pedidos")
      .select(
        "id, produtor_id, numero_pedido, total, status, status_pagamento, cliente_nome, cliente_email, cliente_telefone"
      )
      .eq("id", pedido_id)
      .maybeSingle();

    if (pedidoErr) return json({ error: "Erro ao buscar pedido" }, 500);
    if (!pedido) return json({ error: "Pedido não encontrado" }, 404);

    if (pedido.produtor_id !== produtor_id) {
      return json({ error: "Pedido não pertence a este produtor" }, 403);
    }

    const amount = Number(pedido.total ?? body.total ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Total do pedido inválido" }, 400);
    }

    const { data: produtor, error: prodErr } = await sb
      .from("produtores")
      .select("id, nome_loja, mp_connected, mp_access_token")
      .eq("id", produtor_id)
      .maybeSingle();

    if (prodErr) return json({ error: "Erro ao buscar produtor" }, 500);
    if (!produtor) return json({ error: "Produtor não encontrado" }, 404);

    const mpToken =
      produtor.mp_connected && produtor.mp_access_token
        ? produtor.mp_access_token
        : MP_ACCESS_TOKEN_FALLBACK;

    if (!mpToken) {
      return json(
        {
          error:
            "Produtor não conectado ao Mercado Pago e MP_ACCESS_TOKEN global não configurado.",
        },
        400
      );
    }

    // Expiração: 30 minutos
    const expiresAt = addMinutes(new Date(), 30).toISOString();

    const description = `Pedido ${pedido.numero_pedido || numero_pedido || pedido.id} - ${
      produtor.nome_loja || "Loja"
    }`.trim();

    const payerEmail =
      pedido.cliente_email && String(pedido.cliente_email).includes("@")
        ? String(pedido.cliente_email).trim().toLowerCase()
        : "cliente@exemplo.com";

    const externalRef = String(pedido.numero_pedido || numero_pedido || pedido.id);

    const mpPayload: Record<string, unknown> = {
      transaction_amount: Number(amount.toFixed(2)),
      description,
      payment_method_id: "pix",
      payer: {
        email: payerEmail,
        first_name: pedido.cliente_nome || "Cliente",
      },
      external_reference: externalRef,
      metadata: {
        pedido_id: pedido.id,
        produtor_id: produtor_id,
      },
      date_of_expiration: expiresAt,
    };

    if (MP_WEBHOOK_URL) {
      mpPayload.notification_url = MP_WEBHOOK_URL;
    }

    // ✅ IDMPOTENCY KEY (NUNCA pode ser null)
    // determinística por pedido (evita duplicar PIX em re-tentativas)
    const idempotencyKey = `pix_${pedido.id}`;

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpText = await mpRes.text();
    let mpJson: any = null;
    try {
      mpJson = mpText ? JSON.parse(mpText) : null;
    } catch {
      mpJson = { raw: mpText };
    }

    if (!mpRes.ok) {
      console.error("Mercado Pago error:", mpRes.status, mpJson);
      return json({ error: "Erro ao criar PIX no Mercado Pago", details: mpJson }, 400);
    }

    const paymentId = mpJson?.id ? String(mpJson.id) : null;
    const qrCode = mpJson?.point_of_interaction?.transaction_data?.qr_code ?? null;
    const qrBase64 = mpJson?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    const ticketUrl = mpJson?.point_of_interaction?.transaction_data?.ticket_url ?? null;
    const mpExpires = mpJson?.date_of_expiration ?? expiresAt;

    if (!qrCode && !qrBase64) {
      console.error("MP retornou sem QR:", mpJson);
      return json({ error: "Mercado Pago não retornou QR Code do PIX" }, 400);
    }

    const { error: updErr } = await sb
      .from("pedidos")
      .update({
        payment_provider: "mercadopago",
        payment_id: paymentId,
        id_pagamento: paymentId,
        pix_qr_code: qrCode,
        pix_qr_code_base64: qrBase64,
        pix_expires_at: mpExpires,
        status_pagamento: "pendente",
        status: "aguardando_confirmacao",
      })
      .eq("id", pedido.id);

    if (updErr) {
      console.error("Erro ao atualizar pedido:", updErr);
      return json({ error: "PIX criado, mas falhou ao salvar no pedido" }, 500);
    }

    return json(
      {
        ok: true,
        pedido_id: pedido.id,
        payment_id: paymentId,
        pix_qr_code: qrCode,
        pix_qr_code_base64: qrBase64,
        pix_expires_at: mpExpires,
        ticket_url: ticketUrl,
      },
      200
    );
  } catch (err) {
    console.error(err);
    return json({ error: "Erro interno" }, 500);
  }
});
