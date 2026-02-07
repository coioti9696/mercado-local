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

  // ✅ novo: status aberto/fechado
  const [aberto, setAberto] = useState<boolean>(true);
  const [savingAberto, setSavingAberto] = useState(false);

  const [stats, setStats] = useState({
    totalProdutos: 0,
    totalVendas: 0,
    receitaTotal: 0,
    pagamentosPendentes: 0,
  });

  const producerFirstName = useMemo(() => {
    const raw = (producer as any)?.nome_responsavel || (producer as any)?.name || "";
    const first = String(raw).trim().split(" ")[0];
    return first || "Produtor";
  }, [producer]);

  useEffect(() => {
    if (authLoading || !producer?.id) return;

    const loadDashboard = async () => {
      setLoading(true);

      try {
        // ✅ puxa também "aberto" (novo)
        const { data: produtorData, error: prodErr } = await supabase
          .from("produtores")
          .select("slug, aberto")
          .eq("id", producer.id)
          .single();

        if (prodErr) throw prodErr;

        if (produtorData?.slug) setProdutorSlug(produtorData.slug);

        // default seguro (se vier null por algum motivo)
        setAberto(Boolean(produtorData?.aberto));

        const [{ count: totalProdutos }, { data: pedidosData }] = await Promise.all([
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

        const receitaTotal = pedidosData?.reduce((sum, p) => sum + (p.total || 0), 0) || 0;

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

  // ✅ toggle aberto/fechado (salva no banco)
  const toggleAberto = async () => {
    if (!producer?.id) return;

    const next = !aberto;
    setAberto(next); // otimista (UI responde na hora)
    setSavingAberto(true);

    try {
      const { error } = await supabase
        .from("produtores")
        .update({ aberto: next })
        .eq("id", producer.id);

      if (error) throw error;

      toast.success(next ? "Loja marcada como ABERTA" : "Loja marcada como FECHADA");
    } catch (e) {
      console.error(e);
      // rollback
      setAberto(!next);
      toast.error("Não foi possível atualizar. Tente novamente.");
    } finally {
      setSavingAberto(false);
    }
  };

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

            {/* ✅ ações (lado direito): toggle + novo produto */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* Toggle Aberto/Fechado */}
              <button
                type="button"
                onClick={toggleAberto}
                disabled={savingAberto}
                className={[
                  "w-full sm:w-auto inline-flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition",
                  "bg-card hover:bg-secondary/30",
                  savingAberto ? "opacity-70 cursor-not-allowed" : "",
                ].join(" ")}
                aria-pressed={aberto}
              >
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-xs text-muted-foreground">Status da loja</span>
                  <span className="text-sm font-semibold">
                    {aberto ? "Aberto" : "Fechado"}
                  </span>
                </div>

                {/* switch visual */}
                <span
                  className={[
                    "relative inline-flex h-6 w-11 items-center rounded-full transition",
                    aberto ? "bg-emerald-500" : "bg-rose-500",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block h-5 w-5 transform rounded-full bg-white transition",
                      aberto ? "translate-x-5" : "translate-x-1",
                    ].join(" ")}
                  />
                </span>
              </button>

              <Button
                onClick={() => navigate("/app/produtor/produtos?new=true")}
                className="w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" /> Novo Produto
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Produtos" value={stats.totalProdutos} icon={Package} subtitle="Cadastrados" />
            <StatCard title="Vendas" value={stats.totalVendas} icon={ShoppingBag} subtitle="Finalizadas" />
            <StatCard title="Receita" value={formatMoney(stats.receitaTotal)} icon={DollarSign} subtitle="Total (finalizado)" />
            <StatCard title="Pendências" value={stats.pagamentosPendentes} icon={Clock} subtitle="Pagamentos" />
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

          {/* ✅ dica rápida (não quebra nada) */}
          <div className="text-xs text-muted-foreground">
            Dica: quando você marcar <b>Fechado</b>, a loja pública vai mostrar esse status em destaque.
          </div>
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
          {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
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
