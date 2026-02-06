import { useEffect, useMemo, useState } from 'react';
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
  ChevronDown,
  ChevronUp,
  BadgeCheck,
  CreditCard,
  Wallet,
  TruckIcon,
  Store,
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
 * ✅ Pegamos o tipo real do item direto do seu Order em @/types,
 * pra não bater de frente com o TS.
 */
type OrderItems = NonNullable<Order['items']>;
type OrderItem = OrderItems extends Array<infer T> ? T : never;

/**
 * Resultado do select do Supabase (pedido_itens + produtos)
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

function paymentIcon(method?: string | null) {
  const m = (method || '').toLowerCase();
  if (m.includes('pix')) return Wallet;
  if (m.includes('cart')) return CreditCard;
  if (m.includes('din')) return Wallet;
  return BadgeCheck;
}

function deliveryIcon(method?: string | null) {
  const m = (method || '').toLowerCase();
  if (m.includes('ret')) return Store;
  return TruckIcon;
}

export default function ProducerOrders() {
  const { producer } = useAuth();

  const [statusSelecionado, setStatusSelecionado] =
    useState<OrderStatus | 'all'>('all');
  const [pedidos, setPedidos] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ controla expand/collapse por pedido
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const countsByStatus = useMemo(() => {
    const counts: Record<string, number> = {
      all: pedidos.length,
      novo: 0,
      confirmado: 0,
      preparo: 0,
      a_caminho: 0,
      finalizado: 0,
      cancelado: 0,
    };
    for (const p of pedidos) counts[p.status] = (counts[p.status] || 0) + 1;
    return counts;
  }, [pedidos]);

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

            items: (itensPorDisplayId[displayId] || []) as unknown as OrderItems,
          };
        });

        setPedidos(pedidosFormatados);

        // ✅ default: expande os "novo"
        const nextExpanded: Record<string, boolean> = {};
        for (const p of pedidosFormatados) {
          nextExpanded[p.id] = p.status === 'novo';
        }
        setExpanded(nextExpanded);
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

  /**
   * ✅ Correção importante:
   * Seu pedido.id aqui é o "displayId" (numero_pedido OU uuid).
   * Então na atualização, tentamos localizar:
   * - primeiro por numero_pedido (se existir)
   * - se não, tentamos por id (uuid)
   */
  const handleMudarStatus = async (displayId: string, novoStatus: OrderStatus) => {
    try {
      // tenta por numero_pedido
      const byNumero = await supabase
        .from('pedidos')
        .select('id')
        .eq('numero_pedido', displayId)
        .eq('produtor_id', producer!.id)
        .maybeSingle();

      let pedidoUuid = byNumero.data?.id as string | undefined;

      // fallback por uuid (quando displayId é uuid)
      if (!pedidoUuid) {
        const byId = await supabase
          .from('pedidos')
          .select('id')
          .eq('id', displayId)
          .eq('produtor_id', producer!.id)
          .maybeSingle();

        pedidoUuid = byId.data?.id as string | undefined;
      }

      if (!pedidoUuid) throw new Error('Pedido não encontrado');

      const { error } = await supabase
        .from('pedidos')
        .update({ status: novoStatus })
        .eq('id', pedidoUuid);

      if (error) throw error;

      setPedidos((prev) =>
        prev.map((p) => (p.id === displayId ? { ...p, status: novoStatus } : p))
      );

      toast.success(`Pedido #${displayId} atualizado`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atualizar pedido');
    }
  };

  return (
    <DashboardLayout type="producer">
      {/* Top bar */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe, confirme e atualize o status dos pedidos.
            </p>
          </div>
        </div>

        {/* Filtro sticky */}
        <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-background/80 backdrop-blur border-b">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {abasStatus.map((tab) => {
              const active = statusSelecionado === tab.value;
              const count = countsByStatus[tab.value] ?? 0;

              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusSelecionado(tab.value)}
                  className={cn(
                    'shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border transition',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary/40 hover:bg-secondary border-border'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      active
                        ? 'bg-primary-foreground/15 text-primary-foreground'
                        : 'bg-background/60 text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary mx-auto mb-4" />
            <p className="text-center text-sm text-muted-foreground">
              Carregando pedidos…
            </p>
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="text-center py-12 border rounded-2xl bg-card">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="font-medium">Nenhum pedido encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Quando um cliente fizer um pedido, ele aparece aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pedidosFiltrados.map((pedido) => {
              const troco = extractTrocoFromNotes(pedido.notes);
              const isOpen = !!expanded[pedido.id];

              const PaymentIcon = paymentIcon(pedido.paymentMethod);
              const DeliveryIcon = deliveryIcon(pedido.deliveryMethod);

              const itens = (pedido.items || []) as unknown as Array<{
                name?: string;
                quantity?: number;
                unitPrice?: number;
                total?: number;
              }>;

              return (
                <div
                  key={pedido.id}
                  className="rounded-2xl border bg-card shadow-sm overflow-hidden"
                >
                  {/* Header */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            #{pedido.id}
                          </span>
                          <StatusBadge status={pedido.status} />
                        </div>

                        <p className="text-sm text-muted-foreground mt-1">
                          {pedido.customerName}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">
                          {formatMoney(Number(pedido.total) || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(pedido.createdAt, {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Infos rápidas */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span className="text-foreground/90">
                          {pedido.customerPhone || '—'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span className="text-foreground/90">
                          {pedido.deliveryDate || '—'}{' '}
                          {pedido.deliveryTime ? `• ${pedido.deliveryTime}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="text-foreground/90 break-words">
                          {pedido.customerAddress || '—'}
                        </span>
                      </div>

                      {/* Pagamento / Entrega */}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <PaymentIcon className="w-4 h-4" />
                        <span className="text-foreground/90">
                          {pedido.paymentMethod || '—'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DeliveryIcon className="w-4 h-4" />
                        <span className="text-foreground/90">
                          {pedido.deliveryMethod || '—'}
                        </span>
                      </div>

                      {troco && (
                        <div className="sm:col-span-2 text-xs text-muted-foreground">
                          Troco:{' '}
                          <span className="font-medium text-foreground">
                            {troco}
                          </span>
                        </div>
                      )}

                      {!!pedido.notes?.trim() && (
                        <div className="sm:col-span-2 text-xs text-muted-foreground">
                          Obs:{' '}
                          <span className="text-foreground/90">
                            {pedido.notes}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Itens (colapsável) */}
                  <div className="border-t">
                    <button
                      className="w-full px-4 sm:px-5 py-3 flex items-center justify-between hover:bg-secondary/30 transition"
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [pedido.id]: !prev[pedido.id],
                        }))
                      }
                    >
                      <div className="text-sm font-semibold">
                        Itens do pedido{' '}
                        <span className="text-muted-foreground font-normal">
                          ({itens.length})
                        </span>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-4 sm:px-5 pb-4 space-y-2">
                        {itens.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nenhum item encontrado para este pedido.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {itens.map((it, idx) => (
                              <div
                                key={`${pedido.id}-item-${idx}`}
                                className="flex items-start justify-between gap-3 rounded-xl bg-secondary/25 p-3"
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

                            <div className="pt-1 space-y-1 text-sm">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Subtotal</span>
                                <span>{formatMoney(Number(pedido.subtotal) || 0)}</span>
                              </div>

                              <div className="flex justify-between text-muted-foreground">
                                <span>Entrega</span>
                                <span>{formatMoney(Number(pedido.deliveryFee) || 0)}</span>
                              </div>

                              <div className="flex justify-between font-semibold">
                                <span>Total</span>
                                <span className="text-foreground">
                                  {formatMoney(Number(pedido.total) || 0)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="border-t p-4 sm:p-5">
                    <div className="flex flex-wrap gap-2">
                      {acoesStatus.map((acao) => {
                        const Icon = acao.icon;
                        const disabled = pedido.status === acao.status;

                        return (
                          <Button
                            key={acao.status}
                            size="sm"
                            variant={acao.status === 'cancelado' ? 'destructive' : 'default'}
                            disabled={disabled}
                            onClick={() => handleMudarStatus(pedido.id, acao.status)}
                            className={cn(
                              'gap-1.5',
                              acao.status !== 'cancelado' && 'bg-primary hover:bg-primary/90',
                              disabled && 'opacity-60'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            {acao.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
