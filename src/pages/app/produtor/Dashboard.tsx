import { useEffect, useMemo, useState } from "react";
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
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));

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

  const producerFirstName = useMemo(() => {
    const raw =
      // tenta pegar algo “humano” se existir
      (producer as any)?.nome_responsavel ||
      (producer as any)?.name ||
      "";
    const first = String(raw).trim().split(" ")[0];
    return first || "Produtor";
  }, [producer]);

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

        const [{ count: totalProdutos }, { data: pedidosData }] =
          await Promise.all([
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
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Carregando sua conta…</p>
          </div>
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
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Atualizando seus dados…</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header premium */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
                  <Sparkles className="w-4 h-4 text-primary" />
                </span>
                <h1 className="text-2xl font-bold">Seu Dashboard</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Olá, <span className="font-medium text-foreground">{producerFirstName}</span> —
                acompanhe seus números e gerencie sua loja.
              </p>
            </div>

            <Button
              onClick={() => navigate("/app/produtor/produtos?new=true")}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" /> Novo Produto
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Produtos"
              value={stats.totalProdutos}
              icon={Package}
              subtitle="Cadastrados"
            />
            <StatCard
              title="Vendas"
              value={stats.totalVendas}
              icon={ShoppingBag}
              subtitle="Finalizadas"
            />
            <StatCard
              title="Receita"
              value={formatMoney(stats.receitaTotal)}
              icon={DollarSign}
              subtitle="Total (finalizado)"
            />
            <StatCard
              title="Pendências"
              value={stats.pagamentosPendentes}
              icon={Clock}
              subtitle="Pagamentos"
            />
          </div>

          {/* Ações rápidas - mantém links e rotas */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ações Rápidas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Atalhos para as principais áreas do painel.
              </p>
            </CardHeader>

            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="justify-start h-12"
                onClick={() => navigate("/app/produtor/produtos")}
              >
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 mr-2">
                  <Package className="w-4 h-4 text-primary" />
                </span>
                Produtos
              </Button>

              <Button
                variant="outline"
                className="justify-start h-12"
                onClick={() => navigate("/app/produtor/pedidos")}
              >
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 mr-2">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                </span>
                Pedidos
              </Button>

              <Button
                variant="outline"
                className="justify-start h-12"
                onClick={() => navigate("/app/produtor/configuracoes")}
              >
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 mr-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                </span>
                Configurações
              </Button>

              <Button
                variant="outline"
                className="justify-start h-12"
                onClick={openStoreInNewTab}
              >
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 mr-2">
                  <Users className="w-4 h-4 text-primary" />
                </span>
                Minha Loja
                <ExternalLink className="w-4 h-4 ml-auto text-muted-foreground" />
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
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: any;
  subtitle?: string;
  icon: any;
}) => (
  <Card className="overflow-hidden">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1 truncate">{value}</p>
          {subtitle ? (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          ) : null}
        </div>

        <div className="shrink-0">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </span>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default ProducerDashboard;
