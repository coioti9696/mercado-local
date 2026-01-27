import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { Producer } from "@/types";

interface AuthContextType {
  user: any | null;
  producer: Producer | null;
  authenticated: boolean;
  role: "admin" | "producer" | null;
  loading: boolean; // 🔐 apenas AUTH
  producerLoading: boolean; // 🏭 dados do produtor/admin
  login: (email: string, password: string) => Promise<{ success: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [producer, setProducer] = useState<Producer | null>(null);
  const [role, setRole] = useState<"admin" | "producer" | null>(null);

  const [loading, setLoading] = useState(true); // AUTH
  const [producerLoading, setProducerLoading] = useState(false); // PERFIL

  // ✅ Mantém a sessão em memória para consistência (principalmente para Edge invoke)
  const [hasSession, setHasSession] = useState(false);

  const authenticated = useMemo(() => {
    // ✅ "authenticated" só é true quando temos user E session válida
    return Boolean(user?.id && hasSession);
  }, [user?.id, hasSession]);

  // =====================================================
  // 🔐 INIT AUTH (F5 SAFE) — SOMENTE AUTH
  // =====================================================
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        setLoading(true);

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("Auth getSession error:", error);
        }

        if (!session?.user || !session?.access_token) {
          setUser(null);
          setProducer(null);
          setRole(null);
          setHasSession(false);
          setLoading(false);
          return;
        }

        setUser(session.user);
        setHasSession(true);
        setLoading(false);
      } catch (e) {
        console.error("Auth init error:", e);
        if (!mounted) return;
        setUser(null);
        setProducer(null);
        setRole(null);
        setHasSession(false);
        setLoading(false);
      }
    };

    initAuth();

    // ✅ Listener de mudanças de sessão (login/logout/refresh)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        // 🔥 garante consistência durante trocas de usuário / refresh token
        if (!session?.user || !session?.access_token) {
          setUser(null);
          setProducer(null);
          setRole(null);
          setHasSession(false);
          setLoading(false);
          return;
        }

        setUser(session.user);
        setHasSession(true);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // =====================================================
  // 🏭 LOAD PERFIL (PRODUTOR OU ADMIN)
  // =====================================================
  useEffect(() => {
    if (!authenticated || !user?.id) {
      setProducer(null);
      setRole(null);
      return;
    }

    let mounted = true;
    setProducerLoading(true);

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("produtores")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!mounted) return;

        if (!data || error) {
          if (error) console.error("Erro ao carregar perfil:", error);
          setProducer(null);
          setRole(null);
          return;
        }

        setProducer(data);

        // 🔥 REGRA ÚNICA DE PAPEL
        if (data.plano === "admin") setRole("admin");
        else setRole("producer");
      } finally {
        if (mounted) setProducerLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [authenticated, user?.id]);

  // =====================================================
  // 🔐 LOGIN
  // =====================================================
  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
      console.error("Erro no login:", error);
      return { success: false };
    }

    // ✅ garante estado consistente imediatamente (evita "invoke sem token")
    if (data?.session?.user && data.session.access_token) {
      setUser(data.session.user);
      setHasSession(true);
    }

    return { success: true };
  };

  // =====================================================
  // 🚪 LOGOUT
  // =====================================================
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProducer(null);
    setRole(null);
    setHasSession(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        producer,
        role,
        authenticated,
        loading,
        producerLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
