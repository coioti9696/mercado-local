import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { StatsCard } from '@/components/StatsCard';
import { supabase } from '@/lib/supabase';
import {
  Store,
  CheckCircle,
  AlertTriangle,
  XCircle,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ProducerRow {
  id: string;
  nome_loja: string;
  email: string;
  plano: 'trial' | 'mensal' | 'anual' | 'admin';
  status_pagamento: 'pago' | 'pendente' | 'atrasado';
  data_inicio: string;
  data_vencimento: string;
  logo_url: string | null;
  created_at: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [producers, setProducers] = useState<ProducerRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ===============================
  // LOAD DASHBOARD DATA (REAL)
  // ===============================
  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('produtores')
        .select(`
          id,
          nome_loja,
          email,
          plano,
          status_pagamento,
          data_inicio,
          data_vencimento,
          logo_url,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar dashboard:', error);
        toast.error('Erro ao carregar dados do dashboard');
        setLoading(false);
        return;
      }

      setProducers((data || []) as ProducerRow[]);
      setLoading(false);
    };

    loadDashboard();
  }, []);

  // ===============================
  // METRICS (REAIS)
  // ===============================
  const produtoresValidos = producers.filter(p => p.plano !== 'admin');

  const totalProducers = produtoresValidos.length;

  const activeSubscriptions = produtoresValidos.filter(
    p => p.status_pagamento === 'pago'
  ).length;

  const pendingSubscriptions = produtoresValidos.filter(
    p => p.status_pagamento === 'pendente'
  ).length;

  const overdueSubscriptions = produtoresValidos.filter(
    p => p.status_pagamento === 'atrasado'
  ).length;

  const monthlyRevenue = produtoresValidos.reduce((sum, p) => {
    if (p.status_pagamento !== 'pago') return sum;

    if (p.plano === 'mensal') return sum + 99.9;
    if (p.plano === 'anual') return sum + 999.9 / 12;

    return sum;
  }, 0);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);

  const getStatusColor = (status: ProducerRow['status_pagamento']) => {
    switch (status) {
      case 'pago':
        return 'bg-success/10 text-success';
      case 'pendente':
        return 'bg-warning/10 text-warning';
      case 'atrasado':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: ProducerRow['status_pagamento']) => {
    switch (status) {
      case 'pago':
        return 'Pago';
      case 'pendente':
        return 'Pendente';
      case 'atrasado':
        return 'Atrasado';
      default:
        return status;
    }
  };

  // ===============================
  // RENDER
  // ===============================
  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Controle real de produtores e assinaturas
          </p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total de produtores" value={totalProducers} icon={Store} />
          <StatsCard title="Assinaturas ativas" value={activeSubscriptions} icon={CheckCircle} />
          <StatsCard title="Pagamentos pendentes" value={pendingSubscriptions} icon={AlertTriangle} />
          <StatsCard title="Receita mensal" value={formatPrice(monthlyRevenue)} icon={CreditCard} />
        </div>

        {/* ALERTA */}
        {overdueSubscriptions > 0 && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold">
                  {overdueSubscriptions} produtor(es) com pagamento atrasado
                </p>
                <p className="text-sm text-muted-foreground">
                  Ação necessária para regularização
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TABELA */}
        <div>
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-semibold">Produtores cadastrados</h2>
            <button
              onClick={() => navigate('/app/admin/produtores')}
              className="text-sm text-primary hover:underline"
            >
              Ver todos
            </button>
          </div>

          <div className="bg-card rounded-2xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">Produtor</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">Plano</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Vencimento</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {produtoresValidos.slice(0, 5).map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            p.logo_url ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              p.nome_loja
                            )}&background=4CAF50&color=fff`
                          }
                          className="w-10 h-10 rounded-xl object-cover"
                        />
                        <div>
                          <p className="font-medium">{p.nome_loja}</p>
                          <p className="text-sm text-muted-foreground">{p.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 hidden sm:table-cell capitalize">
                      {p.plano}
                    </td>

                    <td className="px-4 py-4 hidden md:table-cell">
                      {format(new Date(p.data_vencimento), 'dd/MM/yyyy', {
                        locale: ptBR,
                      })}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          getStatusColor(p.status_pagamento)
                        )}
                      >
                        {getStatusLabel(p.status_pagamento)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && produtoresValidos.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">
                Nenhum produtor cadastrado ainda.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
