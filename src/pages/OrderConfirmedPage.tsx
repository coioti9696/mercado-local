import { useEffect, useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { supabase, supabaseGuest } from '@/lib/supabase';
import { toast } from 'sonner';

const BRAZIL_TZ = 'America/Sao_Paulo';

const OrderConfirmedPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ numeroPedido: string }>();

  // ✅ Número vem da rota OU do state do checkout (sem #)
  const numeroPedidoRaw =
    params.numeroPedido || location.state?.numero_pedido || '';
  const numeroPedido = useMemo(
    () => String(numeroPedidoRaw).trim(),
    [numeroPedidoRaw]
  );

  const slug = location.state?.slug;

  const [status, setStatus] = useState<string>('Aguardando confirmação');
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ NOVO: campos de pagamento (sem quebrar o que já existe)
  const [metodoPagamento, setMetodoPagamento] = useState<string | null>(null);
  const [statusPagamento, setStatusPagamento] = useState<string>('pendente');
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState<string | null>(null);
  const [pixExpiresAt, setPixExpiresAt] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<string | null>(null);

  const formatarStatus = (s?: string) => {
    if (!s) return '—';
    return s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatarStatusPagamento = (s?: string) => {
    if (!s) return '—';
    const v = String(s).toLowerCase();
    if (v === 'pago' || v === 'approved') return 'Pago';
    if (v === 'pendente' || v === 'pending') return 'Pendente';
    if (v === 'cancelado' || v === 'cancelled') return 'Cancelado';
    if (v === 'expirado' || v === 'expired') return 'Expirado';
    return formatarStatus(s);
  };

  /**
   * ✅ Parse robusto:
   * - Se já tiver timezone (Z ou ±hh:mm), usa direto
   * - Se vier "YYYY-MM-DD HH:mm:ss" ou "YYYY-MM-DDTHH:mm:ss" sem timezone,
   *   assume UTC adicionando "Z" (padrão do Supabase/DB)
   */
  const parseSupabaseDateToDate = (value?: string | null) => {
    if (!value) return null;

    const v = String(value).trim();
    if (!v) return null;

    const hasTZ = /[zZ]|[+-]\d{2}:\d{2}$/.test(v);
    if (hasTZ) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }

    // troca espaço por T e adiciona Z (assumindo UTC)
    const normalized = v.includes(' ') ? v.replace(' ', 'T') : v;
    const withZ = normalized.endsWith('Z') ? normalized : `${normalized}Z`;

    const d = new Date(withZ);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatarDataHora = (value?: string | null) => {
    const d = parseSupabaseDateToDate(value);
    if (!d) return '—';

    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: BRAZIL_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const pixExpirado = useMemo(() => {
    if (!pixExpiresAt) return false;
    const d = parseSupabaseDateToDate(pixExpiresAt);
    if (!d) return false;
    return d.getTime() <= Date.now();
  }, [pixExpiresAt]);

  const isPix = useMemo(() => {
    return (metodoPagamento || '').toLowerCase() === 'pix';
  }, [metodoPagamento]);

  const pagamentoAprovado = useMemo(() => {
    const v = (statusPagamento || '').toLowerCase();
    return v === 'pago' || v === 'approved';
  }, [statusPagamento]);

  const fetchOrderData = useCallback(async () => {
    if (!numeroPedido) return;

    try {
      setLoading(true);

      // ✅ Escolhe client correto:
      // - Logado => supabase (produtor)
      // - Não logado => supabaseGuest (cliente com x-guest-token)
      const { data: sessionData } = await supabase.auth.getSession();
      const isLogged = !!sessionData?.session?.user;

      const client = isLogged ? supabase : supabaseGuest;

      const { data, error } = await client
        .from('pedidos')
        .select(
          `
          status,
          created_at,
          metodo_pagamento,
          status_pagamento,
          payment_provider,
          pix_qr_code,
          pix_qr_code_base64,
          pix_expires_at
        `
        )
        .eq('numero_pedido', numeroPedido)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setStatus('Pedido não encontrado');
        setCreatedAt(null);
        setMetodoPagamento(null);
        setStatusPagamento('pendente');
        setPaymentProvider(null);
        setPixQrCode(null);
        setPixQrCodeBase64(null);
        setPixExpiresAt(null);
        return;
      }

      if (data.status) setStatus(data.status);
      if (data.created_at) setCreatedAt(data.created_at);

      // ✅ pagamento
      setMetodoPagamento(data.metodo_pagamento || null);
      setStatusPagamento(data.status_pagamento || 'pendente');
      setPaymentProvider(data.payment_provider || null);
      setPixQrCode(data.pix_qr_code || null);
      setPixQrCodeBase64(data.pix_qr_code_base64 || null);
      setPixExpiresAt(data.pix_expires_at || null);
    } catch (err) {
      console.error('Erro ao buscar dados do pedido:', err);
      toast.error('Erro ao buscar dados do pedido');
    } finally {
      setLoading(false);
    }
  }, [numeroPedido]);

  useEffect(() => {
    if (!numeroPedido) {
      setLoading(false);
      return;
    }

    fetchOrderData();
    const interval = setInterval(fetchOrderData, 5000);
    return () => clearInterval(interval);
  }, [numeroPedido, fetchOrderData]);

  const copiarPix = async () => {
    if (!pixQrCode) {
      toast.error('Código PIX não disponível.');
      return;
    }
    try {
      await navigator.clipboard.writeText(pixQrCode);
      toast.success('Código PIX copiado!');
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando pedido...
      </div>
    );
  }

  if (!numeroPedido) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Pedido não encontrado
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-secondary p-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-6 bg-success/10 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Pedido confirmado!</h1>

        <p className="text-muted-foreground mb-8">
          Acompanhe o status do seu pedido abaixo.
        </p>

        <div className="bg-card rounded-2xl border p-6 mb-6">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Número do pedido</span>
              <span className="font-medium">{numeroPedido}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-info">
                {formatarStatus(status)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Data e hora</span>
              <span className="font-medium">{formatarDataHora(createdAt)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Pagamento</span>
              <span
                className={`font-medium ${
                  pagamentoAprovado ? 'text-success' : 'text-warning'
                }`}
              >
                {formatarStatusPagamento(statusPagamento)}
              </span>
            </div>

            {paymentProvider && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provedor</span>
                <span className="font-medium">
                  {formatarStatus(paymentProvider)}
                </span>
              </div>
            )}
          </div>
        </div>

        {isPix && !pagamentoAprovado && (
          <div className="bg-card rounded-2xl border p-6 mb-6 text-left space-y-4">
            <div>
              <p className="font-semibold">Pague com PIX para confirmar</p>
              <p className="text-sm text-muted-foreground">
                Após o pagamento, esta tela atualiza automaticamente.
              </p>
            </div>

            {pixExpiresAt && (
              <p
                className={`text-sm ${
                  pixExpirado ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {pixExpirado
                  ? '⚠️ Este PIX expirou. Volte e gere novamente.'
                  : `Expira em: ${formatarDataHora(pixExpiresAt)}`}
              </p>
            )}

            {pixQrCodeBase64 ? (
              <div className="flex items-center justify-center">
                <img
                  src={`data:image/png;base64,${pixQrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-56 h-56 rounded-xl border bg-white p-2"
                />
              </div>
            ) : null}

            {pixQrCode ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">PIX Copia e Cola</p>
                <div className="rounded-xl border p-3 bg-background">
                  <p className="text-xs break-all">{pixQrCode}</p>
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={copiarPix}
                  disabled={!pixQrCode}
                >
                  Copiar código PIX
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Gerando código PIX… (se isso persistir, aguarde alguns segundos e tente atualizar)
              </p>
            )}
          </div>
        )}

        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            if (slug) navigate(`/loja/${slug}`);
            else navigate(-1);
          }}
          className="w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    </div>
  );
};

export default OrderConfirmedPage;
