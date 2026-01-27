import { useState } from 'react';
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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type PaymentMethod = 'pix' | 'dinheiro' | 'cartao';

type PixData = {
  qr_code: string | null;
  qr_code_base64: string | null;
  expires_at: string | null;
  payment_id: string | null;
};

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

  // 🚨 Segurança
  if (!produtor_id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Produtor inválido. Volte para a loja.</p>
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
    const cleaned = value.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.');
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

  // ===============================
  // CONFIRMAR PEDIDO
  // ===============================
  const handleSubmit = async () => {
    if (
      !formData.nome ||
      !formData.telefone ||
      !formData.endereco ||
      !formData.numero ||
      !formData.bairro ||
      !formData.cep
    ) {
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

      // ✅ limpa qualquer PIX anterior (caso o usuário volte e gere de novo)
      setPixData(null);
      setPixOrderNumber(null);

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

      // 1️⃣ Criar pedido
      const { data: pedido, error: pedidoError } = await supabase
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

      const { error: itensError } = await supabase.from('pedido_itens').insert(itens);
      if (itensError) throw itensError;

      // ✅ Se NÃO for PIX, mantém seu fluxo atual INTACTO
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

      // ✅ PIX: chama Edge Function para gerar QR (valor = total do carrinho/pedido)
      // Observação: a função idealmente usa o pedido_id para buscar total/produtor no banco (mais seguro).
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

      // ✅ Guarda para exibir na tela (sem rota nova)
      setPixOrderNumber(numeroPedido);
      setPixData({
        qr_code,
        qr_code_base64,
        expires_at,
        payment_id,
      });

      // ✅ Carrinho pode ser limpo aqui com segurança, porque o pedido já foi criado
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
      <div className="min-h-screen flex items-center justify-center">
        <p>Carrinho vazio</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-secondary">
      {/* HEADER */}
      <header className="sticky top-0 bg-background border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            disabled={!!pixData}
          >
            <ArrowLeft />
          </Button>
          <h1 className="text-lg font-semibold">Finalizar pedido</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-40 space-y-6">
        {/* ✅ Se PIX foi gerado, mostra QR e não mexe no resto */}
        {pixData ? (
          <div className="bg-card rounded-xl border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Pagamento via PIX</p>
                <p className="text-sm text-muted-foreground">
                  Pedido: <b>#{pixOrderNumber}</b> • Total: <b>{formatPrice(total)}</b>
                </p>
                {pixData.expires_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Expira em: {new Date(pixData.expires_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </div>

            {pixData.qr_code_base64 && (
              <div className="flex items-center justify-center">
                <img
                  alt="QR Code PIX"
                  className="w-64 h-64 rounded-xl border bg-white p-2"
                  src={`data:image/png;base64,${pixData.qr_code_base64}`}
                />
              </div>
            )}

            {pixData.qr_code && (
              <div className="space-y-2">
                <Label>Código PIX (copia e cola)</Label>
                <Textarea value={pixData.qr_code} readOnly className="min-h-[120px]" />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => copyToClipboard(pixData.qr_code!)}
                >
                  Copiar código PIX
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                type="button"
                className="w-full"
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
                className="w-full"
                onClick={() => {
                  toast.info('Assim que o pagamento for confirmado, o status atualizará sozinho.');
                }}
              >
                Já paguei (aguardar confirmação)
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Assim que o pagamento for aprovado, o status do pedido atualizará automaticamente.
            </p>
          </div>
        ) : (
          <>
            {/* ITENS */}
            <div className="bg-card rounded-xl border">
              {items.map((item) => (
                <div key={item.product.id} className="p-4 flex gap-4 border-b">
                  <img
                    src={item.product.image}
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.product.price)} x {item.quantity}
                    </p>
                    <p className="text-sm font-semibold">
                      {formatPrice(item.product.price * item.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Minus
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    />
                    {item.quantity}
                    <Plus
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    />
                    <Trash2 onClick={() => removeItem(item.product.id)} />
                  </div>
                </div>
              ))}
            </div>

            {/* TOTAL */}
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>

            {/* DADOS DO CLIENTE */}
            <div className="space-y-3">
              <Label>Nome completo</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />

              <Label>Telefone</Label>
              <Input
                value={formData.telefone}
                onChange={(e) =>
                  setFormData({ ...formData, telefone: formatPhone(e.target.value) })
                }
                placeholder="(00) 00000-0000"
              />

              <Label>Rua</Label>
              <Input
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              />

              <Label>Número</Label>
              <Input
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
              />

              <Label>Bairro</Label>
              <Input
                value={formData.bairro}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
              />

              <Label>CEP</Label>
              <Input
                value={formData.cep}
                onChange={(e) =>
                  setFormData({ ...formData, cep: formatCEP(e.target.value) })
                }
                placeholder="00000-000"
                inputMode="numeric"
              />

              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              />
            </div>

            {/* PAGAMENTO */}
            <div className="space-y-3">
              <p className="font-medium">Pagar online</p>
              <Button
                type="button"
                variant={paymentMethod === 'pix' ? 'default' : 'outline'}
                className="w-full justify-start gap-2"
                onClick={() => {
                  setPaymentMethod('pix');
                  setPrecisaTroco(false);
                  setValorTroco('');
                }}
              >
                <Smartphone /> PIX
              </Button>

              <p className="font-medium mt-4">Pagar na entrega</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={paymentMethod === 'dinheiro' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('dinheiro')}
                >
                  <Banknote className="mr-2" /> Dinheiro
                </Button>

                <Button
                  type="button"
                  variant={paymentMethod === 'cartao' ? 'default' : 'outline'}
                  onClick={() => {
                    setPaymentMethod('cartao');
                    setPrecisaTroco(false);
                    setValorTroco('');
                  }}
                >
                  <CreditCard className="mr-2" /> Cartão
                </Button>
              </div>

              {/* ✅ Troco só aparece se dinheiro */}
              {paymentMethod === 'dinheiro' && (
                <div className="mt-4 space-y-3 rounded-xl border bg-card p-4 text-left">
                  <p className="font-medium">Troco</p>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant={precisaTroco ? 'default' : 'outline'}
                      onClick={() => setPrecisaTroco(true)}
                    >
                      Precisa
                    </Button>
                    <Button
                      type="button"
                      size="sm"
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
                    <div className="space-y-2">
                      <Label>Valor para troco</Label>
                      <Input
                        value={valorTroco}
                        onChange={(e) => setValorTroco(e.target.value)}
                        placeholder="Ex: 50,00"
                        inputMode="decimal"
                      />
                      <p className="text-xs text-muted-foreground">
                        Dica: informe quanto você vai pagar para o produtor levar o troco.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* FOOTER */}
      {!pixData && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button className="w-full" disabled={loading} onClick={handleSubmit}>
            {loading ? 'Enviando pedido...' : 'Confirmar pedido'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CheckoutPage;
