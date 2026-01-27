import { cn } from '@/lib/utils';
import { OrderStatus } from '@/types';

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  novo: { label: 'Novo', className: 'bg-info/10 text-info border-info/20' },
  confirmado: { label: 'Confirmado', className: 'bg-primary/10 text-primary border-primary/20' },
  preparo: { label: 'Em Preparo', className: 'bg-warning/10 text-warning border-warning/20' },
  a_caminho: { label: 'A Caminho', className: 'bg-secondary/10 text-secondary-foreground border-secondary/20' },
  finalizado: { label: 'Finalizado', className: 'bg-success/10 text-success border-success/20' },
  cancelado: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  // Verifica se o status é válido, caso contrário, usa um valor default ('novo')
  const config = statusConfig[status] || statusConfig.novo;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
};
