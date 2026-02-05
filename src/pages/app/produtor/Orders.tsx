import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Order, OrderStatus } from '@/types';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  ChefHat,
  Truck,
  XCircle,
  Package,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/* =========================
   STATUS DO PAINEL
========================= */
const abasStatus: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'novo', label: 'Novos' },
  { value: 'confirmado', label: 'Confirmados' },
  { value: 'preparo', label: 'Em preparo' },
  { value: 'a_caminho', label: 'A caminho' },
  { value: 'finalizado', label: 'Finalizados' },
  { value: 'cancelado', label: 'Cancelados' },
];

const acoesStatus = [
  { status: 'confirmado', label: 'Confirmar', icon: CheckCircle },
  { status: 'preparo', label: 'Em preparo', icon: ChefHat },
  { status: 'a_caminho', label: 'A caminho', icon: Truck },
  { status: 'finalizado', label: 'Finalizar', icon: Package },
  { status: 'cancelado', label: 'Cancelar', icon: XCircle },
] as const;

/* =========================
   MAPA DE STATUS (BANCO → UI)
========================= */
const mapStatus = (status: string): OrderStatus => {
  if (status === 'aguardando_confirmacao') return 'novo';
  return status as OrderStatus;
};

/* =========================
   TROCO (LÊ DE observacoes)
========================= */
const extractTrocoFromNotes = (notes?: string | null) => {
  if (!notes) return null;

  const text = notes.trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  if (!lower.includes('troco')) return null;

  const idx = lower.indexOf('troco');
  const after = text.slice(idx);

  const match = after.match(/(\d{1,6}(?:[.,]\d{1,2})?)/);
  if (!match) return 'Sim';

  const raw = match[1].replace('.', '').replace(',', '.');
  const value = Number(raw);
  if (Number.isNaN(value)) return 'Sim';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value || 0
  );

/**
 * ✅ AQUI ESTÁ O PULO DO GATO:
 * Pegamos o tipo real do item direto do seu Order em @/types,
 * pra não bater de frente com o TS.
 */
type OrderItems = NonNullable<Order['items']>;
type OrderItem = OrderItems extends Array<infer T> ? T : never;

/**
 * Resultado do select do Supabase (pedido_itens + produtos)
 * (tipagem local só pra facilitar o merge)
 */
type PedidoItemRow = {
  pedido_id: string;
  quantidade: number;
  preco_unitario: number;
  total_item: number | null;
  produtos: {
    id: string;
    nome: string;
    imagem_url: string | null;
  } | null;
};

export default function ProducerOrders() {
  const { producer } = useAuth();

  const [statusSelecionado, setStatusSelecionado] =
    useState<OrderStatus | 'all'>('all');
  const [pedidos, setPedidos] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!producer?.id) return;

    const buscarPedidos = async () => {
      setLoading(true);

      try {
        // 1) PEDIDOS
        const { data: pedidosDb, error: pedidosErr } = await supabase
          .from('pedidos')
          .select('*')
          .eq('produtor_id', producer.id)
          .order('created_at', { ascending: false });

        if (pedidosErr) throw pedidosErr;

        const rows = pedidosDb || [];
        const pedidoUuids = rows.map((p) => p.id as string);

        // Map: pedido_uuid -> display id (#numero_pedido ou uuid)
        const displayIdByPedidoUuid: Record<string, string> = {};
        for (const p of rows) {
          displayIdByPedidoUuid[p.id] = p.numero_pedido || p.id;
        }

        // 2) ITENS
        const itensPorDisplayId: Record<string, OrderItem[]> = {};

        if (pedidoUuids.length > 0) {
          const { data: itensDb, error: itensErr } = await supabase
            .from('pedido_itens')
            .select(
              `
              pedido_id,
              quantidade,
              preco_unitario,
              total_item,
              produtos (
                id,
                nome,
                imagem_url
              )
            `
            )
            .in('pedido_id', pedidoUuids);

          if (itensErr) {
            console.error('Erro ao carregar itens do pedido:', itensErr);
          } else {
            const itens = (itensDb || []) as unknown as PedidoItemRow[];

            for (const it of itens) {
              const displayId = displayIdByPedidoUuid[it.pedido_id];
              if (!displayId) continue;

              if (!itensPorDisplayId[displayId]) itensPorDisplayId[displayId] = [];

              const nome = it.produtos?.nome || 'Produto';
              const unitPrice = Number(it.preco_unitario) || 0;
              const quantity = Number(it.quantidade) || 0;
              const total =
                typeof it.total_item === 'number'
                  ? Number(it.total_item)
                  : unitPrice * quantity;

              /**
               * ✅ Montamos o objeto no formato "mais provável"
               * e tipamos como OrderItem sem forçar alterações no seu @/types.
               * Se seu OrderItem tiver campos extras, não quebra.
               */
              const item = {
                name: nome,
                quantity,
                unitPrice,
                total,
                image: it.produtos?.imagem_url || undefined,
                productId: it.produtos?.id,
              } as unknown as OrderItem;

              itensPorDisplayId[displayId].push(item);
            }
          }
        }

        // 3) FORMATAÇÃO
        const pedidosFormatados: Order[] = rows.map((pedido) => {
          const displayId = pedido.numero_pedido || pedido.id;

          return {
            id: displayId,
            producerId: pedido.produtor_id,
            producerName: producer.name,
            customerName: pedido.cliente_nome || 'Cliente',
            customerPhone: pedido.cliente_telefone || '',
            customerEmail: pedido.cliente_email,

            customerAddress: [
              pedido.cliente_endereco,
              pedido.cliente_numero && `nº ${pedido.cliente_numero}`,
              pedido.cliente_bairro,
              pedido.cliente_cidade,
              pedido.cliente_cep,
            ]
              .filter(Boolean)
              .join(', '),

            status: mapStatus(pedido.status),
            paymentMethod: pedido.metodo_pagamento,
            total: Number(pedido.total) || 0,
            subtotal: Number(pedido.subtotal) || 0,
            deliveryFee: Number(pedido.taxa_entrega) || 0,
            deliveryMethod: pedido.metodo_entrega,
            deliveryDate: pedido.data_entrega,
            deliveryTime: pedido.horario_entrega,
            notes: pedido.observacoes,
            paymentStatus: pedido.status_pagamento,
            paymentId: pedido.id_pagamento,
            createdAt: new Date(pedido.created_at),
            updatedAt: new Date(pedido.updated_at || pedido.created_at),

            // ✅ agora vem com itens
            items: (itensPorDisplayId[displayId] || []) as unknown as OrderItems,
          };
        });

        setPedidos(pedidosFormatados);
      } catch (err) {
        console.error(err);
        toast.error('Erro ao carregar pedidos');
      } finally {
        setLoading(false);
      }
    };

    buscarPedidos();
  }, [producer?.id]);

  const pedidosFiltrados =
    statusSelecionado === 'all'
      ? pedidos
      : pedidos.filter((p) => p.status === statusSelecionado);

  const handleMudarStatus = async (
    numeroPedido: string,
    novoStatus: OrderStatus
  ) => {
    try {
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('id')
        .eq('numero_pedido', numeroPedido)
        .eq('produtor_id', producer!.id)
        .single();

      if (!pedido) throw new Error('Pedido não encontrado');

      await supabase
        .from('pedidos')
        .update({ status: novoStatus })
        .eq('id', pedido.id);

      setPedidos((prev) =>
        prev.map((p) =>
          p.id === numeroPedido ? { ...p, status: novoStatus } : p
        )
      );

      toast.success(`Pedido #${numeroPedido} atualizado`);
    } catch {
      toast.error('Erro ao atualizar pedido');
    }
  };

  return (
    <DashboardLayout type="producer">
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary mx-auto mb-4" />
          <p>Carregando pedidos…</p>
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p>Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto">
            {abasStatus.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusSelecionado(tab.value)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium',
                  statusSelecionado === tab.value
                    ? 'bg-primary text-white'
                    : 'bg-secondary'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pedidosFiltrados.map((pedido) => {
              const troco = extractTrocoFromNotes(pedido.notes);

              // render: usamos "unknown" pra não depender do shape exato do seu OrderItem
              const itens = (pedido.items || []) as unknown as Array<{
                name?: string;
                quantity?: number;
                unitPrice?: number;
                total?: number;
              }>;

              return (
                <div key={pedido.id} className="border rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">#{pedido.id}</span>
                    <StatusBadge status={pedido.status} />
                  </div>

                  <p className="text-sm">{pedido.customerName}</p>

                  <div className="text-sm text-muted-foreground mt-2 space-y-1">
                    <div className="flex gap-2">
                      <Phone className="w-4 h-4" />
                      {pedido.customerPhone}
                    </div>

                    <div className="flex gap-2">
                      <MapPin className="w-4 h-4" />
                      {pedido.customerAddress}
                    </div>

                    <div className="flex gap-2">
                      <Clock className="w-4 h-4" />
                      {formatDistanceToNow(pedido.createdAt, {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>

                    {troco && (
                      <div className="flex gap-2">
                        <span className="w-4 h-4" />
                        <span>
                          Troco:{' '}
                          <span className="font-medium text-foreground">
                            {troco}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ✅ ITENS */}
                  <div className="mt-3 rounded-lg bg-secondary/40 p-3">
                    <p className="text-sm font-semibold text-foreground mb-2">
                      Itens do pedido
                    </p>

                    {itens.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum item encontrado para este pedido.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {itens.map((it, idx) => (
                          <div
                            key={`${pedido.id}-item-${idx}`}
                            className="flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {(it.quantity ?? 0)}x {it.name || 'Produto'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatMoney(Number(it.unitPrice) || 0)} un.
                              </p>
                            </div>

                            <div className="text-sm font-semibold text-foreground whitespace-nowrap">
                              {formatMoney(Number(it.total) || 0)}
                            </div>
                          </div>
                        ))}

                        <div className="border-t pt-2 mt-2 flex justify-between text-sm">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-semibold text-foreground">
                            {formatMoney(Number(pedido.total) || 0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t mt-3 pt-3 flex flex-wrap gap-2">
                    {acoesStatus.map((acao) => {
                      const Icon = acao.icon;
                      return (
                        <Button
                          key={acao.status}
                          size="sm"
                          disabled={pedido.status === acao.status}
                          onClick={() => handleMudarStatus(pedido.id, acao.status)}
                          className="gap-1.5"
                        >
                          <Icon className="w-4 h-4" />
                          {acao.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
