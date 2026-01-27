import { Order } from '@/types';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Phone, MapPin, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrderCardProps {
  order: Order;
  onViewDetails?: () => void;
  showActions?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onViewDetails,
  showActions = true,
}) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const paymentLabels = {
    pix: 'PIX',
    dinheiro: 'Dinheiro',
    cartao: 'Cartão',
  };

  return (
    <div className="bg-card rounded-2xl p-4 shadow-premium border border-border/50 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">#{order.id}</span>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {order.customerName}
          </p>
        </div>
        <span className="text-lg font-bold text-primary">
          {formatPrice(order.total)}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="w-4 h-4" />
          {order.customerPhone}
        </div>
        {order.customerAddress && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="line-clamp-1">{order.customerAddress}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          {formatDistanceToNow(order.createdAt, { addSuffix: true, locale: ptBR })}
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">
            {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
          </span>
          <span className="text-muted-foreground">
            {paymentLabels[order.paymentMethod]}
          </span>
        </div>
        
        {showActions && (
          <Button
            variant="ghost"
            className="w-full justify-between"
            onClick={onViewDetails}
          >
            Ver detalhes
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
