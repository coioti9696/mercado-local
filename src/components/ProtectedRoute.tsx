import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const ProtectedRoute = ({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: "admin" | "producer";
}) => {
  const { authenticated, role: userRole, loading } = useAuth();

  /**
   * 🔥 REGRA DE OURO:
   * - ProtectedRoute só protege sessão
   * - NÃO depende de producer
   * - NÃO trava a tela
   */

  // ⏳ Enquanto o AuthContext ainda não decidiu
  if (loading) {
    return null; // ⚠️ NÃO spinner, NÃO redirect
  }

  // ❌ Sem sessão
  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  // ❌ Role inválida (apenas se role existir)
  if (role && userRole && userRole !== role) {
    return <Navigate to="/" replace />;
  }

  // ✅ Libera render SEM bloqueios
  return <>{children}</>;
};
