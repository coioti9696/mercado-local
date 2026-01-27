import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const InvitePage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const [invalidLink, setInvalidLink] = useState(false);
  const [invalidReason, setInvalidReason] = useState<string>("");

  // Hash vem assim: #access_token=...&refresh_token=...&type=invite
  const hashParams = useMemo(() => {
    const raw = (location.hash || "").replace(/^#/, "").trim();
    return new URLSearchParams(raw);
  }, [location.hash]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setInvalidLink(false);
        setInvalidReason("");

        // 1) Se o hash já veio com erro do Supabase (ex: otp_expired), mostramos a tela correta
        const hashError = hashParams.get("error");
        const hashErrorCode = hashParams.get("error_code");
        const hashErrorDesc = hashParams.get("error_description");

        if (hashError || hashErrorCode) {
          setInvalidLink(true);
          setInvalidReason(
            decodeURIComponent(hashErrorDesc || "") ||
              hashErrorCode ||
              hashError ||
              "Link inválido ou expirado"
          );
          setLoading(false);
          return;
        }

        // 2) Se veio access_token no hash, força a sessão desse convite (isso sobrescreve sessão antiga)
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        if (access_token && refresh_token) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (setErr) {
            console.error("setSession error:", setErr);
            setInvalidLink(true);
            setInvalidReason(setErr.message || "Não foi possível validar o convite.");
            setLoading(false);
            return;
          }
        }

        // 3) Agora buscamos o usuário da sessão (seja ela do hash ou já existente)
        const { data: userRes, error: userErr } = await supabase.auth.getUser();

        if (userErr || !userRes?.user?.email) {
          // Sem user => link inválido/expirado OU sessão não foi aplicada
          console.error("getUser error:", userErr);
          setInvalidLink(true);
          setInvalidReason(
            userErr?.message || "Convite inválido ou expirado. Peça para reenviar."
          );
          setLoading(false);
          return;
        }

        setSessionEmail(userRes.user.email);
        setLoading(false);
      } catch (e: any) {
        console.error(e);
        setInvalidLink(true);
        setInvalidReason(e?.message || "Convite inválido ou expirado.");
        setLoading(false);
      }
    };

    run();
  }, [hashParams]);

  const handleSetPassword = async () => {
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }

    try {
      setSaving(true);

      // ✅ Atualiza senha do usuário do convite (precisa estar autenticado via setSession)
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Senha definida com sucesso! Faça login para acessar.");

      // ✅ IMPORTANTÍSSIMO: encerra sessão do convite para não ficar logado automaticamente
      await supabase.auth.signOut();

      // manda para login (com email preenchido)
      navigate("/login", { replace: true, state: { email: sessionEmail } });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao definir senha.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando convite...
      </div>
    );
  }

  if (invalidLink) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-bold">Convite inválido ou expirado</h1>
          <p className="text-muted-foreground">
            {invalidReason || "Peça para o administrador reenviar o convite."}
          </p>
          <Button onClick={() => navigate("/login")} className="w-full">
            Ir para login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-secondary p-6">
      <div className="max-w-md w-full bg-card border rounded-2xl p-6 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Definir senha</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conta: <b>{sessionEmail}</b>
          </p>
        </div>

        <div className="space-y-3">
          <Input
            type="password"
            placeholder="Nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <Button className="w-full" onClick={handleSetPassword} disabled={saving}>
          {saving ? "Salvando..." : "Salvar senha"}
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/login")}
          disabled={saving}
        >
          Voltar
        </Button>
      </div>
    </div>
  );
};

export default InvitePage;
