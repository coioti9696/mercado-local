import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export const AuthGate = ({ children }: { children: ReactNode }) => {
  const { loading } = useAuth();

  /**
   * ✅ Regra profissional:
   * - Espera o Supabase finalizar a decisão da sessão (loading === false)
   * - Não depende de producer/role (isso fica por conta das telas)
   */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
};
