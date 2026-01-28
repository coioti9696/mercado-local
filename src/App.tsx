import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AuthGate } from "@/contexts/AuthGate";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import StorePage from "./pages/loja/StorePage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderConfirmedPage from "./pages/OrderConfirmedPage";

// ✅ NOVA PAGE (CONVITE / CRIAR SENHA)
import InvitePage from "./pages/InvitePage";

// ✅ NOVA PAGE (CALLBACK MERCADO PAGO)
import MpCallbackPage from "./pages/MpCallbackPage";

// Producer
import ProducerDashboard from "./pages/app/produtor/Dashboard";
import ProducerProducts from "./pages/app/produtor/Products";
import ProducerOrders from "./pages/app/produtor/Orders";
import ProducerSettings from "./pages/app/produtor/Settings";

// Admin
import AdminDashboard from "./pages/app/admin/Dashboard";
import AdminProducers from "./pages/app/admin/Producers";
import AdminSettings from "./pages/app/admin/Settings";

const queryClient = new QueryClient();

/* ============================
   🔐 PROTECTED ROUTE (FINAL)
============================ */
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { authenticated } = useAuth();

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/* ============================
   📍 ROTAS
============================ */
const AppRoutes = () => (
  <Routes>
    {/* Públicas */}
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/loja/:slug" element={<StorePage />} />
    <Route path="/checkout" element={<CheckoutPage />} />

    {/* ✅ CONVITE DO PRODUTOR (CRIAR SENHA) */}
    <Route path="/convite" element={<InvitePage />} />

   {/* ✅ CALLBACK OAUTH MERCADO PAGO (NÃO PROTEGIDA) */}
<Route path="/mp/callback" element={<MpCallbackPage />} />
<Route path="/mp-callback" element={<MpCallbackPage />} />


    {/* ✅ Pedido confirmado (checkout) */}
    <Route path="/pedido-confirmado" element={<OrderConfirmedPage />} />

    {/* ✅ Pedido confirmado (histórico / detalhes) */}
    <Route
      path="/pedido-confirmado/:numeroPedido"
      element={<OrderConfirmedPage />}
    />

    {/* Produtor */}
    <Route
      path="/app/produtor/dashboard"
      element={
        <ProtectedRoute>
          <ProducerDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/app/produtor/produtos"
      element={
        <ProtectedRoute>
          <ProducerProducts />
        </ProtectedRoute>
      }
    />
    <Route
      path="/app/produtor/pedidos"
      element={
        <ProtectedRoute>
          <ProducerOrders />
        </ProtectedRoute>
      }
    />
    <Route
      path="/app/produtor/configuracoes"
      element={
        <ProtectedRoute>
          <ProducerSettings />
        </ProtectedRoute>
      }
    />

    {/* Admin */}
    <Route
      path="/app/admin/dashboard"
      element={
        <ProtectedRoute>
          <AdminDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/app/admin/produtores"
      element={
        <ProtectedRoute>
          <AdminProducers />
        </ProtectedRoute>
      }
    />
    <Route
      path="/app/admin/configuracoes"
      element={
        <ProtectedRoute>
          <AdminSettings />
        </ProtectedRoute>
      }
    />

    {/* 404 */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

/* ============================
   🚀 APP ROOT
============================ */
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AuthGate>
            <CartProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <AppRoutes />
              </TooltipProvider>
            </CartProvider>
          </AuthGate>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
