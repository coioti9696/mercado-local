import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  Package,
  ShoppingBag,
  DollarSign,
  Clock,
  RefreshCw,
  Plus,
  CreditCard,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const ProducerDashboard = () => {
  const { producer, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [produtorSlug, setProdutorSlug] = useState("");

  const [stats, setStats] = useState({
    totalProdutos: 0,
    totalVendas: 0,
    receitaTotal: 0,
    pagamentosPendentes: 0,
  });

  /**
   * ✅ DISPARA SOMENTE QUANDO:
   * - auth terminou
   * - producer existe
   */
  useEffect(() => {
    if (authLoading || !producer?.id) return;

    const loadDashboard = async () => {
      setLoading(true);

      try {
        const { data: produtorData } = await supabase
          .from("produtores")
          .select("slug")
          .eq("id", producer.id)
          .single();

        if (produtorData?.slug) {
          setProdutorSlug(produtorData.slug);
        }

        const [
          { count: totalProdutos },
          { data: pedidosData },
        ] = await Promise.all([
          supabase
            .from("produtos")
            .select("id", { count: "exact", head: true })
            .eq("produtor_id", producer.id),

          supabase
            .from("pedidos")
            .select("total")
            .eq("produtor_id", producer.id)
            .eq("status", "finalizado"),
        ]);

        const receitaTotal =
          pedidosData?.reduce((sum, p) => sum + (p.total || 0), 0) || 0;

        setStats({
          totalProdutos: totalProdutos || 0,
          totalVendas: pedidosData?.length || 0,
          receitaTotal,
          pagamentosPendentes: 0,
        });
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [authLoading, producer?.id]);

  const openStoreInNewTab = () => {
    if (!produtorSlug) {
      toast.error("Slug não configurado");
      return;
    }
    window.open(`/loja/${produtorSlug}`, "_blank", "noopener,noreferrer");
  };

  /* =========================
     🟡 AUTH AINDA CARREGANDO
  ========================= */
  if (authLoading) {
    return (
      <DashboardLayout type="producer">
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  /* =========================
     🔴 SEM PRODUTOR (ERRO REAL)
  ========================= */
  if (!producer) {
    return (
      <DashboardLayout type="producer">
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          Produtor não encontrado para este usuário.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout type="producer">
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">📊 Seu Dashboard</h1>
            <Button onClick={() => navigate("/app/produtor/produtos?new=true")}>
              <Plus className="w-4 h-4 mr-2" /> Novo Produto
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Produtos" value={stats.totalProdutos} icon={Package} />
            <StatCard title="Vendas" value={stats.totalVendas} icon={ShoppingBag} />
            <StatCard title="Receita" value={`R$ ${stats.receitaTotal}`} icon={DollarSign} />
            <StatCard title="Pendências" value={stats.pagamentosPendentes} icon={Clock} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" onClick={() => navigate("/app/produtor/produtos")}>
                <Package className="mr-2 w-4 h-4" /> Produtos
              </Button>
              <Button variant="outline" onClick={() => navigate("/app/produtor/pedidos")}>
                <ShoppingBag className="mr-2 w-4 h-4" /> Pedidos
              </Button>
              <Button variant="outline" onClick={() => navigate("/app/produtor/configuracoes")}>
                <CreditCard className="mr-2 w-4 h-4" /> Configurações
              </Button>
              <Button variant="outline" onClick={openStoreInNewTab}>
                <Users className="mr-2 w-4 h-4" /> Minha Loja
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

const StatCard = ({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: any;
  icon: any;
}) => (
  <Card>
    <CardContent className="flex justify-between items-center py-6">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <Icon className="w-6 h-6 text-muted-foreground" />
    </CardContent>
  </Card>
);

export default ProducerDashboard;
