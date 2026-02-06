import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { supabaseGuest, getOrCreateGuestToken } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import {
  ShoppingBag,
  MapPin,
  History,
  Trash2,
  XCircle,
  Phone,
  CreditCard,
  Banknote,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/components/StatusBadge';
import { Product, OrderStatus } from '@/types';
import { toast } from 'sonner';

interface StoreProducer {
  id: string;
  nome_loja: string;
  slug: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  logo_url?: string;
  capa_url?: string;
  descricao?: string;
  cor_principal?: string;
  aceita_pix?: boolean;
  aceita_dinheiro?: boolean;
  aceita_cartao?: boolean;
  ativo?: boolean;
}

interface Order {
  id: string;
  numero_pedido: string;
  status: OrderStatus;
  created_at: string;
  total: number;
}

const gerarUrlPublica = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;

  return `https://tesmnievlurbrsciocmx.supabase.co/storage/v1/object/public/${url.replace(
    '/storage/v1/object/public/',
    ''
  )}`;
};

// =====================
// Helpers de UI (somente visual)
// =====================
const formatPhoneForDisplay = (raw?: string) => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return raw;
};

const phoneToWhatsAppLink = (raw?: string) => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // Brasil: garante 55
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
};

const parseDescricaoEmBlocos = (text?: string) => {
  const t = (text || '').trim();
  if (!t) return [];

  const normalized = t.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  let blocks = normalized
    .split('\n\n')
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 1) {
    const one = blocks[0];
    const hasBullets = /(^|\n)\s*[-•]/.test(one);
    if (!hasBullets && one.length > 180) {
      blocks = one
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  return blocks;
};

const isBulletBlock = (block: string) => {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  return lines.every((l) => l.startsWith('- ') || l.startsWith('• '));
};

const stripBulletPrefix = (line: string) =>
  line.replace(/^[-•]\s+/, '').trim();

const StorePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { itemCount, total } = useCart();

  const guestToken = useMemo(() => getOrCreateGuestToken(), []);

  const [producer, setProducer] = useState<StoreProducer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // ===============================
  // LOAD STORE
  // ===============================
  useEffect(() => {
    const loadStore = async () => {
      if (!slug) return;

      setLoading(true);

      try {
        const { data: produtor, error: prodErr } = await supabaseGuest
          .from('produtores_public')
          .select(
            'id, nome_loja, slug, cidade, estado, telefone, logo_url, capa_url, descricao, cor_principal, aceita_pix, aceita_dinheiro, aceita_cartao, ativo'
          )
          .eq('slug', slug)
          .maybeSingle();

        if (prodErr || !produtor) {
          console.error('Erro ao carregar produtor:', prodErr);
          setProducer(null);
          setProducts([]);
          setTodayOrders([]);
          return;
        }

        setProducer({
          ...produtor,
          descricao: produtor.descricao || '',
          logo_url: gerarUrlPublica(produtor.logo_url),
          capa_url: gerarUrlPublica(produtor.capa_url),
        });

        const { data: produtos, error: produtosErr } = await supabaseGuest
          .from('produtos')
          .select('*')
          .eq('produtor_id', produtor.id)
          .eq('ativo', true)
          .order('created_at', { ascending: false });

        if (produtosErr) {
          console.error('Erro ao carregar produtos:', produtosErr);
          setProducts([]);
        } else {
          setProducts(
            (produtos || []).map((p: any) => ({
              id: p.id,
              name: p.nome,
              description: p.descricao || '',
              price: p.preco,
              producerId: p.produtor_id,
              unit: 'unidade',
              image: p.imagem_url ? gerarUrlPublica(p.imagem_url) : '',
              isActive: p.ativo,
              stock: p.estoque,
            }))
          );
        }

        const hoje = new Date().toISOString().split('T')[0];

        const { data: pedidos, error: pedidosErr } = await supabaseGuest
          .from('pedidos')
          .select('id, numero_pedido, status, created_at, total')
          .eq('produtor_id', produtor.id)
          .eq('guest_token', guestToken)
          .gte('created_at', `${hoje}T00:00:00`)
          .order('created_at', { ascending: false });

        if (pedidosErr) {
          console.error('Erro ao carregar pedidos do dia:', pedidosErr);
          setTodayOrders([]);
        } else {
          setTodayOrders((pedidos || []) as Order[]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadStore();
  }, [slug, guestToken]);

  const descricaoBlocks = useMemo(
    () => parseDescricaoEmBlocos(producer?.descricao),
    [producer?.descricao]
  );

  const telefoneDisplay = useMemo(
    () => formatPhoneForDisplay(producer?.telefone),
    [producer?.telefone]
  );

  const whatsappLink = useMemo(
    () => phoneToWhatsAppLink(producer?.telefone),
    [producer?.telefone]
  );

  const hasAnyPayment =
    !!producer?.aceita_pix || !!producer?.aceita_cartao || !!producer?.aceita_dinheiro;

  // ===============================
  // ACTIONS (cliente sem login)
  // ===============================
  const cancelarPedido = async (id: string) => {
    try {
      const { error } = await supabaseGuest
        .from('pedidos')
        .update({ status: 'cancelado' })
        .eq('id', id)
        .eq('guest_token', guestToken);

      if (error) {
        console.error('Erro ao cancelar pedido:', error);
        toast.error('Não foi possível cancelar este pedido.');
        return;
      }

      toast.success('Pedido cancelado');
      setTodayOrders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'cancelado' } : p))
      );
    } catch (e) {
      console.error(e);
      toast.error('Erro ao cancelar pedido');
    }
  };

  const excluirPedido = async (id: string) => {
    try {
      const { error } = await supabaseGuest
        .from('pedidos')
        .delete()
        .eq('id', id)
        .eq('guest_token', guestToken);

      if (error) {
        console.error('Erro ao excluir pedido:', error);
        toast.error('Não foi possível excluir este pedido.');
        return;
      }

      toast.success('Pedido excluído');
      setTodayOrders((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir pedido');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando loja...
      </div>
    );
  }

  if (!producer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Produtor não encontrado
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-secondary">
      {/* HEADER PREMIUM */}
      <header className="relative">
        {/* capa */}
        <div className="h-56 bg-muted relative overflow-hidden">
          {producer.capa_url ? (
            <img
              src={producer.capa_url}
              className="w-full h-full object-cover"
              alt="Capa da loja"
            />
          ) : null}

          {/* overlay premium */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-background-secondary" />
        </div>

        {/* content */}
        <div className="px-4 -mt-16">
          <div className="max-w-3xl mx-auto">
            {/* card glass */}
            <div className="rounded-3xl border bg-background/80 backdrop-blur-xl shadow-sm p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* logo */}
                <div className="mx-auto sm:mx-0">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-background shadow-sm bg-muted">
                    {producer.logo_url ? (
                      <img
                        src={producer.logo_url}
                        className="w-full h-full object-cover"
                        alt="Logo"
                      />
                    ) : null}
                  </div>
                </div>

                {/* header info */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <h1 className="text-2xl sm:text-3xl font-bold">
                      {producer.nome_loja}
                    </h1>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border bg-background">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Loja verificada
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground inline-flex items-center justify-center sm:justify-start gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                      <MapPin className="w-4 h-4 text-primary" />
                    </span>
                    {producer.cidade}, {producer.estado}
                  </p>

                  {/* quick actions */}
                  <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-start">
                    {whatsappLink && (
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() => window.open(whatsappLink, '_blank')}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        WhatsApp
                      </Button>
                    )}

                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                          <History className="w-4 h-4 mr-2" />
                          Meus pedidos de hoje ({todayOrders.length})
                        </Button>
                      </SheetTrigger>

                      <SheetContent side="bottom" className="h-[65vh] overflow-y-auto">
                        <SheetHeader>
                          <SheetTitle>Pedidos de hoje</SheetTitle>
                        </SheetHeader>

                        {todayOrders.length === 0 ? (
                          <p className="mt-6 text-center text-muted-foreground">
                            Nenhum pedido hoje
                          </p>
                        ) : (
                          todayOrders.map((order) => (
                            <div
                              key={order.id}
                              className="border rounded-xl p-3 mt-3 space-y-2 bg-background"
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium">
                                  #{order.numero_pedido}
                                </span>
                                <StatusBadge status={order.status} />
                              </div>

                              <p className="font-semibold">
                                R$ {order.total.toFixed(2)}
                              </p>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    navigate(`/pedido-confirmado/${order.numero_pedido}`)
                                  }
                                >
                                  Ver detalhes
                                </Button>

                                {order.status !== 'cancelado' && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => cancelarPedido(order.id)}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Cancelar
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => excluirPedido(order.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              </div>

              {/* INFO CARDS */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {/* pagamento */}
                <div className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Formas de pagamento</p>
                      <p className="text-xs text-muted-foreground">
                        {hasAnyPayment ? 'Aceitos na loja' : 'Não informado'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-background">
                      <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-primary/10">
                        <CreditCard className="w-4 h-4 text-primary" />
                      </span>
                      Pix:{' '}
                      <b className={producer.aceita_pix ? '' : 'text-muted-foreground'}>
                        {producer.aceita_pix ? 'Sim' : 'Não'}
                      </b>
                    </span>

                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-background">
                      <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-primary/10">
                        <CreditCard className="w-4 h-4 text-primary" />
                      </span>
                      Cartão:{' '}
                      <b className={producer.aceita_cartao ? '' : 'text-muted-foreground'}>
                        {producer.aceita_cartao ? 'Sim' : 'Não'}
                      </b>
                    </span>

                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-background">
                      <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-primary/10">
                        <Banknote className="w-4 h-4 text-primary" />
                      </span>
                      Dinheiro:{' '}
                      <b className={producer.aceita_dinheiro ? '' : 'text-muted-foreground'}>
                        {producer.aceita_dinheiro ? 'Sim' : 'Não'}
                      </b>
                    </span>
                  </div>
                </div>

                {/* contato */}
                <div className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
                      <Phone className="w-4 h-4 text-primary" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Contato</p>
                      <p className="text-xs text-muted-foreground">
                        WhatsApp direto com a loja
                      </p>
                    </div>
                  </div>

                  {telefoneDisplay ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-muted-foreground">
                        WhatsApp:{' '}
                        <span className="font-medium text-foreground">
                          {telefoneDisplay}
                        </span>
                      </div>

                      {whatsappLink && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(whatsappLink, '_blank')}
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Abrir
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Contato não informado
                    </div>
                  )}
                </div>
              </div>

              {/* descrição */}
              {descricaoBlocks.length > 0 && (
                <div className="mt-3 rounded-2xl border bg-background p-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Sobre a loja</p>
                      <p className="text-xs text-muted-foreground">
                        Informações, horários e detalhes
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-muted-foreground">
                    {descricaoBlocks.map((block, idx) => {
                      if (isBulletBlock(block)) {
                        const lines = block
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean);
                        return (
                          <ul key={idx} className="list-disc pl-5 space-y-1">
                            {lines.map((l, i) => (
                              <li key={i}>{stripBulletPrefix(l)}</li>
                            ))}
                          </ul>
                        );
                      }

                      const hasInlineBullets =
                        block.includes('\n- ') || block.includes('\n• ');

                      if (hasInlineBullets) {
                        const lines = block
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean);
                        return (
                          <div key={idx} className="space-y-2">
                            {lines.map((l, i) => {
                              const isB = l.startsWith('- ') || l.startsWith('• ');
                              return isB ? (
                                <div key={i} className="flex gap-2">
                                  <span className="mt-1">•</span>
                                  <span>{stripBulletPrefix(l)}</span>
                                </div>
                              ) : (
                                <p key={i}>{l}</p>
                              );
                            })}
                          </div>
                        );
                      }

                      return <p key={idx}>{block}</p>;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* PRODUTOS */}
      <main className="px-4 mt-6 pb-28">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Produtos</h2>
              <p className="text-sm text-muted-foreground">
                {products.length} item(ns) disponíveis
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </main>

      {/* FINALIZAR */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0">
          <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 bg-background/85 backdrop-blur border-t">
            <div className="max-w-3xl mx-auto">
              <Button
                className="w-full"
                onClick={() =>
                  navigate('/checkout', {
                    state: {
                      produtor_id: producer.id,
                      slug: producer.slug,
                    },
                  })
                }
              >
                <ShoppingBag className="mr-2" />
                Finalizar pedido ({itemCount}) • R$ {total.toFixed(2)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorePage;
