import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MpCallbackPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const state = params.get("state");
        const error = params.get("error");
        const errorDesc = params.get("error_description");

        if (error) {
          toast.error(errorDesc || "Conexão cancelada/negada.");
          navigate("/app/produtor/configuracoes", { replace: true });
          return;
        }

        if (!code || !state) {
          toast.error("Callback inválido (sem code/state).");
          navigate("/app/produtor/configuracoes", { replace: true });
          return;
        }

        // garante que está logado
        const { data: sess } = await supabase.auth.getSession();
        if (!sess?.session?.access_token) {
          toast.error("Faça login para concluir a conexão.");
          navigate("/login", { replace: true });
          return;
        }

        const { data, error: fxErr } = await supabase.functions.invoke("mp-oauth-exchange", {
          body: { code, state },
        });

        if (fxErr || !data?.ok) {
          console.error("mp-oauth-exchange error:", fxErr, data);
          toast.error(data?.error || fxErr?.message || "Erro ao conectar Mercado Pago");
          navigate("/app/produtor/configuracoes", { replace: true });
          return;
        }

        toast.success("Mercado Pago conectado com sucesso!");
        navigate("/app/produtor/configuracoes", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [location.search, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-bold">Conectando Mercado Pago...</h1>
        <p className="text-muted-foreground">
          {loading ? "Aguarde alguns segundos." : "Você pode voltar às configurações."}
        </p>
        {!loading && (
          <Button onClick={() => navigate("/app/produtor/configuracoes")} className="w-full">
            Voltar
          </Button>
        )}
      </div>
    </div>
  );
};

export default MpCallbackPage;
