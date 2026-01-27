import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { ShoppingBag, MapPin, History, Trash2, XCircle } from 'lucide-react';
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
  email: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  logo_url?: string;
  capa_url?: string;
  descricao?: string;
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

const StorePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { itemCount, total } = useCart();

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

      try {
        // PRODUTOR
        const { data: produtor } = await supabase
          .from('produtores')
          .select('*')
          .eq('slug', slug)
          .single();

        if (!produtor) return;

        // ✅ GARANTE QUE A DESCRIÇÃO ENTRA NO STATE DO PRODUCER
        setProducer({
          ...produtor,
          descricao: produtor.descricao || '', // <-- ajuste (sem mexer no resto)
          logo_url: gerarUrlPublica(produtor.logo_url),
          capa_url: gerarUrlPublica(produtor.capa_url),
        });

        // PRODUTOS
        const { data: produtos } = await supabase
          .from('produtos')
          .select('*')
          .eq('produtor_id', produtor.id)
          .eq('ativo', true)
          .order('created_at', { ascending: false });

        setProducts(
          (produtos || []).map((p) => ({
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

        // PEDIDOS DO CLIENTE HOJE
        const hoje = new Date().toISOString().split('T')[0];

        const { data: pedidos } = await supabase
          .from('pedidos')
          .select('id, numero_pedido, status, created_at, total')
          .eq('produtor_id', produtor.id)
          .gte('created_at', `${hoje}T00:00:00`)
          .order('created_at', { ascending: false });

        setTodayOrders(pedidos || []);
      } finally {
        setLoading(false);
      }
    };

    loadStore();
  }, [slug]);

  // ===============================
  // ACTIONS
  // ===============================
  const cancelarPedido = async (id: string) => {
    await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', id);

    toast.success('Pedido cancelado');
    setTodayOrders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'cancelado' } : p))
    );
  };

  const excluirPedido = async (id: string) => {
    await supabase.from('pedidos').delete().eq('id', id);

    toast.success('Pedido excluído');
    setTodayOrders((prev) => prev.filter((p) => p.id !== id));
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
      {/* HEADER */}
      <header className="relative">
        <div className="h-40 bg-muted">
          <img src={producer.capa_url} className="w-full h-full object-cover" />
        </div>

        <div className="px-4 -mt-12 text-center">
          <img
            src={producer.logo_url}
            className="w-24 h-24 rounded-xl mx-auto border-4 border-background"
          />

          <h1 className="text-2xl font-bold mt-2">{producer.nome_loja}</h1>

          <p className="text-sm text-muted-foreground flex justify-center gap-1">
            <MapPin className="w-4 h-4" />
            {producer.cidade}, {producer.estado}
          </p>

          {/* ✅ DESCRIÇÃO ABAIXO DA CIDADE */}
          {!!producer.descricao?.trim() && (
            <p className="mt-3 text-sm text-muted-foreground">
              {producer.descricao}
            </p>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="mt-3">
                <History className="w-4 h-4 mr-1" />
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
                    className="border rounded-lg p-3 mt-3 space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <span>#{order.numero_pedido}</span>
                      <StatusBadge status={order.status} />
                    </div>

                    <p className="font-semibold">R$ {order.total.toFixed(2)}</p>

                    <div className="flex gap-2">
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
      </header>

      {/* PRODUTOS */}
      <main className="px-4 mt-6 max-w-2xl mx-auto">
        <div className="grid gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>

      {/* FINALIZAR */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
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
      )}
    </div>
  );
};

export default StorePage;
