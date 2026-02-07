import { useMemo, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Minus,
  Plus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  ShieldCheck,
  MapPin,
  User,
  Phone,
  Hash,
  MessageSquare,
  QrCode,
  Copy,
  BadgeCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ✅ cria um client "guest" com header x-guest-token (necessário para RLS do cliente sem login)
import { createClient } from '@supabase/supabase-js';

type PaymentMethod = 'pix' | 'dinheiro' | 'cartao';

type PixData = {
  qr_code: string | null;
  qr_code_base64: string | null;
  expires_at: string | null;
  payment_id: string | null;
};

const GUEST_TOKEN_KEY = 'ml_guest_token';

function getOrCreateGuestToken() {
  try {
    const existing = localStorage.getItem(GUEST_TOKEN_KEY);
    if (existing && existing.trim().length > 10) return existing.trim();

    const token =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(GUEST_TOKEN_KEY, token);
    return token;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { items, total, updateQuantity, removeItem, clearCart } = useCart();

  // 🔥 Dados vindos da StorePage
  const produtor_id = location.state?.produtor_id;
  const slug = location.state?.slug;

  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    endereco: '',
    numero: '',
    bairro: '',
    cep: '',
    observacoes: '',
  });

  // ✅ Troco (apenas se dinheiro)
  const [precisaTroco, setPrecisaTroco] = useState(false);
  const [valorTroco, setValorTroco] = useState('');

  // ✅ PIX UI (sem criar rota nova)
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixOrderNumber, setPixOrderNumber] = useState<string | null>(null);

  // ✅ guarda o total do pedido no momento do PIX (porque clearCart zera o total do contexto)
  const [pixTotal, setPixTotal] = useState<number | null>(null);

  // 🚨 Segurança
  if (!produtor_id) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border bg-card p-6 text-center">
          <p className="font-semibold text-lg">Produtor inválido</p>
          <p className="text-sm text-muted-foreground mt-1">
            Volte para a loja e tente novamente.
          </p>
          <Button className="mt-4 w-full" onClick={() => navigate('/')}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);

  // 📞 Máscara simples de telefone
  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  };

  // 🏷️ Máscara de CEP: 00000-000
  const formatCEP = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  // 💰 Normaliza valor do troco (aceita 10, 10.5, 10,50)
  const parseMoneyBR = (value: string) => {
    const cleaned = value
      .replace(/[^\d,.-]/g, '')
      .replace('.', '')
      .replace(',', '.');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Código PIX copiado!');
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  // ✅ cria um supabase client com header do guest_token (usado só no checkout)
  const guestToken = useMemo(() => getOrCreateGuestToken(), []);
  const supabaseGuest = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

    if (!url || !anon) return null;

    return createClient(url, anon, {
      global: {
        headers: {
          'x-guest-token': guestToken,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }, [guestToken]);

  const resumoItens = useMemo(() => {
    const subtotal = items.reduce(
      (sum, it) => sum + it.product.price * it.quantity,
      0
    );
    return { subtotal, total };
  }, [items, total]);

  const isFormValid =
    !!formData.nome &&
    !!formData.telefone &&
    !!formData.endereco &&
    !!formData.numero &&
    !!formData.bairro &&
    !!formData.cep;

  // ===============================
  // CONFIRMAR PEDIDO
  // ===============================
  const handleSubmit = async () => {
    if (!isFormValid) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // ✅ valida troco só se dinheiro
    if (paymentMethod === 'dinheiro' && precisaTroco) {
      const trocoNum = parseMoneyBR(valorTroco);
      if (!valorTroco || Number.isNaN(trocoNum) || trocoNum <= 0) {
        toast.error('Informe um valor válido para troco');
        return;
      }
      if (trocoNum < total) {
        toast.error('O valor do troco deve ser maior ou igual ao total do pedido');
        return;
      }
    }

    try {
      setLoading(true);

      // ✅ limpa qualquer PIX anterior
      setPixData(null);
      setPixOrderNumber(null);
      setPixTotal(null);

      const numeroPedido = `${new Date().getFullYear()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const statusPagamento = 'pendente';

      // ✅ Observações finais (inclui troco quando aplicável)
      let observacoesFinal = formData.observacoes?.trim() || '';
      if (paymentMethod === 'dinheiro') {
        if (precisaTroco) {
          const trocoNum = parseMoneyBR(valorTroco);
          const trocoFmt = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(trocoNum);

          observacoesFinal = [
            observacoesFinal,
            `Troco: SIM (levar para ${trocoFmt})`,
          ]
            .filter(Boolean)
            .join(' • ');
        } else {
          observacoesFinal = [observacoesFinal, 'Troco: NÃO']
            .filter(Boolean)
            .join(' • ');
        }
      }

      const db = supabaseGuest ?? supabase;

      // 1️⃣ Criar pedido
      const { data: pedido, error: pedidoError } = await db
        .from('pedidos')
        .insert({
          numero_pedido: numeroPedido,
          produtor_id,
          cliente_nome: formData.nome,
          cliente_telefone: formData.telefone,
          cliente_endereco: formData.endereco,
          cliente_numero: formData.numero,
          cliente_bairro: formData.bairro,
          cliente_cep: formData.cep,
          observacoes: observacoesFinal,
          subtotal: total,
          total,
          metodo_pagamento: paymentMethod,
          status: 'aguardando_confirmacao',
          status_pagamento: statusPagamento,
          payment_provider: paymentMethod === 'pix' ? 'mercadopago' : null,
          guest_token: guestToken,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // 2️⃣ Criar itens
      const itens = items.map((item) => ({
        pedido_id: pedido.id,
        produto_id: item.product.id,
        quantidade: item.quantity,
        preco_unitario: item.product.price,
      }));

      const { error: itensError } = await db.from('pedido_itens').insert(itens);
      if (itensError) throw itensError;

      // ✅ Se NÃO for PIX, mantém fluxo atual
      if (paymentMethod !== 'pix') {
        clearCart();
        navigate('/pedido-confirmado', {
          state: {
            numero_pedido: numeroPedido,
            slug,
          },
        });
        return;
      }

      // ✅ PIX: salva total antes de limpar o carrinho
      setPixTotal(Number(total) || 0);

      // ✅ PIX: chama Edge Function
      const { data: mpData, error: mpErr } = await supabase.functions.invoke(
        'mp-create-pix',
        {
          body: {
            pedido_id: pedido.id,
            numero_pedido: numeroPedido,
            produtor_id,
            total: Number(total) || 0,
          },
        }
      );

      if (mpErr) {
        console.error('mp-create-pix error:', mpErr);
        toast.error('Erro ao gerar PIX. Tente novamente.');
        return;
      }

      // ✅ Normaliza retorno (defensivo)
      const qr_code =
        mpData?.pix_qr_code ?? mpData?.qr_code ?? mpData?.qrCode ?? null;
      const qr_code_base64 =
        mpData?.pix_qr_code_base64 ??
        mpData?.qr_code_base64 ??
        mpData?.qrCodeBase64 ??
        null;
      const expires_at =
        mpData?.pix_expires_at ?? mpData?.expires_at ?? mpData?.expiresAt ?? null;
      const payment_id =
        mpData?.payment_id ?? mpData?.id_pagamento ?? mpData?.paymentId ?? null;

      if (!qr_code && !qr_code_base64) {
        console.error('mp-create-pix retornou sem qr:', mpData);
        toast.error('Não foi possível gerar o QR Code do PIX.');
        return;
      }

      setPixOrderNumber(numeroPedido);
      setPixData({
        qr_code,
        qr_code_base64,
        expires_at,
        payment_id,
      });

      clearCart();

      toast.success('PIX gerado! Pague com o QR Code abaixo.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao finalizar pedido');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0 && !pixData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border bg-card p-6 text-center">
          <p className="font-semibold text-lg">Carrinho vazio</p>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione itens na loja antes de finalizar.
          </p>
          <Button className="mt-4 w-full" onClick={() => navigate(-1)}>
            Voltar para a loja
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-secondary">
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            disabled={!!pixData}
            className="rounded-xl"
          >
            <ArrowLeft />
          </Button>

          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight">
              Finalizar pedido
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Checkout seguro • Dados protegidos
            </p>
          </div>

          {!pixData && (
            <div className="ml-auto hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <BadgeCheck className="w-4 h-4" />
              Total:{' '}
              <span className="font-semibold text-foreground">
                {formatPrice(total)}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-40">
        {/* ✅ PIX: Tela premium do QR */}
        {pixData ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7">
              <div className="bg-card rounded-2xl border p-5 sm:p-6 space-y-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border bg-background p-2">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-lg">Pagamento via PIX</p>
                    <p className="text-sm text-muted-foreground">
                      Pedido: <b>#{pixOrderNumber}</b> • Total:{' '}
                      <b>{formatPrice(pixTotal ?? 0)}</b>
                    </p>
                    {pixData.expires_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Expira em:{' '}
                        {new Date(pixData.expires_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>

                {pixData.qr_code_base64 && (
                  <div className="flex items-center justify-center">
                    <div className="rounded-2xl border bg-white p-3 shadow-sm">
                      <img
                        alt="QR Code PIX"
                        className="w-60 h-60 sm:w-72 sm:h-72 object-contain"
                        src={`data:image/png;base64,${pixData.qr_code_base64}`}
                      />
                    </div>
                  </div>
                )}

                {pixData.qr_code && (
                  <div className="space-y-2">
                    <Label>Código PIX (copia e cola)</Label>
                    <Textarea
                      value={pixData.qr_code}
                      readOnly
                      className="min-h-[130px] rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => copyToClipboard(pixData.qr_code!)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar código PIX
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <Button
                    type="button"
                    className="w-full rounded-xl"
                    onClick={() =>
                      navigate('/pedido-confirmado', {
                        state: {
                          numero_pedido: pixOrderNumber,
                          slug,
                        },
                      })
                    }
                  >
                    Ir para acompanhamento
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => {
                      toast.info(
                        'Assim que o pagamento for confirmado, o status atualizará sozinho.'
                      );
                    }}
                  >
                    Já paguei (aguardar confirmação)
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Assim que o pagamento for aprovado, o status do pedido atualizará automaticamente.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-card rounded-2xl border p-5 sm:p-6 shadow-sm">
                <p className="font-semibold mb-1">Resumo</p>
                <p className="text-sm text-muted-foreground">
                  Você pode fechar esta tela — o pedido já está registrado.
                </p>

                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">
                      {formatPrice(pixTotal ?? 0)}
                    </span>
                  </div>

                  <div className="rounded-xl border bg-secondary/30 p-3 text-xs text-muted-foreground">
                    Dica: Se o seu banco exigir, use “PIX copia e cola” no app do banco.
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // ✅ Checkout normal: layout premium 2 colunas
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* ESQUERDA: formulário */}
            <div className="lg:col-span-7 space-y-4">
              {/* Itens */}
              <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b">
                  <p className="font-semibold text-lg">Seu carrinho</p>
                  <p className="text-sm text-muted-foreground">
                    Revise os itens antes de confirmar.
                  </p>
                </div>

                <div className="divide-y">
                  {items.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-4 sm:p-5 flex gap-4"
                    >
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted border shrink-0">
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(item.product.price)} • un.
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 rounded-xl border bg-background px-2 py-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity - 1)
                              }
                              aria-label="Diminuir quantidade"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>

                            <span className="text-sm font-semibold w-6 text-center">
                              {item.quantity}
                            </span>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity + 1)
                              }
                              aria-label="Aumentar quantidade"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">
                              {formatPrice(item.product.price * item.quantity)}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 px-2 text-destructive hover:text-destructive rounded-lg"
                              onClick={() => removeItem(item.product.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-5 sm:p-6 border-t bg-secondary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dados do cliente */}
              <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b">
                  <p className="font-semibold text-lg">Dados para entrega</p>
                  <p className="text-sm text-muted-foreground">
                    Preencha para o produtor entregar corretamente.
                  </p>
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Nome completo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) =>
                        setFormData({ ...formData, nome: e.target.value })
                      }
                      placeholder="Ex: João da Silva"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Telefone <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          telefone: formatPhone(e.target.value),
                        })
                      }
                      placeholder="(00) 00000-0000"
                      className="rounded-xl"
                      inputMode="tel"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8 space-y-2">
                      <Label className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        Rua <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={formData.endereco}
                        onChange={(e) =>
                          setFormData({ ...formData, endereco: e.target.value })
                        }
                        placeholder="Ex: Rua das Flores"
                        className="rounded-xl"
                      />
                    </div>

                    <div className="sm:col-span-4 space-y-2">
                      <Label className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-muted-foreground" />
                        Número <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={formData.numero}
                        onChange={(e) =>
                          setFormData({ ...formData, numero: e.target.value })
                        }
                        placeholder="Ex: 123"
                        className="rounded-xl"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-7 space-y-2">
                      <Label>
                        Bairro <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={formData.bairro}
                        onChange={(e) =>
                          setFormData({ ...formData, bairro: e.target.value })
                        }
                        placeholder="Ex: Centro"
                        className="rounded-xl"
                      />
                    </div>

                    <div className="sm:col-span-5 space-y-2">
                      <Label>
                        CEP <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={formData.cep}
                        onChange={(e) =>
                          setFormData({ ...formData, cep: formatCEP(e.target.value) })
                        }
                        placeholder="00000-000"
                        className="rounded-xl"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      Observações
                    </Label>
                    <Textarea
                      value={formData.observacoes}
                      onChange={(e) =>
                        setFormData({ ...formData, observacoes: e.target.value })
                      }
                      className="rounded-xl min-h-[110px]"
                      placeholder="Ex: Portão azul, chamar no WhatsApp..."
                    />
                  </div>
                </div>
              </div>

              {/* Pagamento */}
              <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b">
                  <p className="font-semibold text-lg">Pagamento</p>
                  <p className="text-sm text-muted-foreground">
                    Escolha como prefere pagar.
                  </p>
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Pagar online</p>

                    <Button
                      type="button"
                      variant={paymentMethod === 'pix' ? 'default' : 'outline'}
                      className="w-full justify-start gap-2 rounded-xl h-12"
                      onClick={() => {
                        setPaymentMethod('pix');
                        setPrecisaTroco(false);
                        setValorTroco('');
                      }}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span className="font-medium">PIX</span>
                      <span className="ml-auto text-xs opacity-80">
                        QR Code / Copia e cola
                      </span>
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Pagar na entrega</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={paymentMethod === 'dinheiro' ? 'default' : 'outline'}
                        className="rounded-xl h-12 justify-start"
                        onClick={() => setPaymentMethod('dinheiro')}
                      >
                        <Banknote className="w-4 h-4 mr-2" /> Dinheiro
                      </Button>

                      <Button
                        type="button"
                        variant={paymentMethod === 'cartao' ? 'default' : 'outline'}
                        className="rounded-xl h-12 justify-start"
                        onClick={() => {
                          setPaymentMethod('cartao');
                          setPrecisaTroco(false);
                          setValorTroco('');
                        }}
                      >
                        <CreditCard className="w-4 h-4 mr-2" /> Cartão
                      </Button>
                    </div>
                  </div>

                  {/* ✅ Troco só aparece se dinheiro */}
                  {paymentMethod === 'dinheiro' && (
                    <div className="mt-2 rounded-2xl border bg-secondary/20 p-4 sm:p-5">
                      <p className="font-semibold">Troco</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Informe se precisa de troco (opcional).
                      </p>

                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl"
                          variant={precisaTroco ? 'default' : 'outline'}
                          onClick={() => setPrecisaTroco(true)}
                        >
                          Precisa
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl"
                          variant={!precisaTroco ? 'default' : 'outline'}
                          onClick={() => {
                            setPrecisaTroco(false);
                            setValorTroco('');
                          }}
                        >
                          Não precisa
                        </Button>
                      </div>

                      {precisaTroco && (
                        <div className="space-y-2 mt-4">
                          <Label>Valor para troco</Label>
                          <Input
                            value={valorTroco}
                            onChange={(e) => setValorTroco(e.target.value)}
                            placeholder="Ex: 50,00"
                            inputMode="decimal"
                            className="rounded-xl"
                          />
                          <p className="text-xs text-muted-foreground">
                            Dica: informe quanto você vai pagar para o produtor levar o troco.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DIREITA: resumo fixo (desktop) */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-[92px] space-y-4">
                <div className="bg-card rounded-2xl border shadow-sm p-5 sm:p-6">
                  <p className="font-semibold text-lg">Resumo do pedido</p>
                  <p className="text-sm text-muted-foreground">
                    Revise antes de confirmar.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">
                        {formatPrice(resumoItens.subtotal)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Entrega</span>
                      <span className="font-medium">{formatPrice(0)}</span>
                    </div>

                    <div className="h-px bg-border my-2" />

                    <div className="flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="text-xl font-bold text-primary">
                        {formatPrice(total)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border bg-secondary/20 p-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Importante:</span>{' '}
                    Verifique os dados de entrega antes de confirmar.
                  </div>

                  {!isFormValid && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      Preencha os campos obrigatórios para liberar a confirmação.
                    </div>
                  )}
                </div>

                {/* Selinho de confiança */}
                <div className="bg-card rounded-2xl border shadow-sm p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border bg-background p-2">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold">Compra segura</p>
                      <p className="text-sm text-muted-foreground">
                        Seus dados são usados apenas para entrega do pedido.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER (mobile + geral) */}
      {!pixData && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur border-t">
          <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center justify-between sm:justify-start sm:gap-3">
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="text-lg font-bold text-primary">
                {formatPrice(total)}
              </div>
            </div>

            <Button
              className="w-full sm:w-auto sm:min-w-[260px] rounded-xl h-12"
              disabled={loading || !isFormValid || items.length === 0}
              onClick={handleSubmit}
            >
              {loading ? (
                'Enviando pedido...'
              ) : paymentMethod === 'pix' ? (
                <>
                  <QrCode className="w-4 h-4 mr-2" />
                  Confirmar e gerar PIX
                </>
              ) : (
                'Confirmar pedido'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutPage;
