import { createClient } from '@supabase/supabase-js'

// =====================
// ENV
// =====================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  // ⚠️ Não logue chaves. Apenas avise.
  console.error('❌ Supabase env ausente. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
}

// =====================
// GUEST TOKEN (cliente sem login)
// =====================
export const GUEST_TOKEN_KEY = 'ml_guest_token'

export function getOrCreateGuestToken() {
  try {
    const existing = localStorage.getItem(GUEST_TOKEN_KEY)
    if (existing && existing.trim().length > 10) return existing.trim()

    const token =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    localStorage.setItem(GUEST_TOKEN_KEY, token)
    return token
  } catch {
    // fallback se localStorage falhar (raro)
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

// =====================
// SUPABASE (logado / painel / admin / produtor)
// =====================
export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,

    /**
     * ✅ IMPORTANTE:
     * Convite tratado manualmente no /convite usando exchangeCodeForSession(code).
     * Manter false evita “pegar” sessão em rotas erradas.
     */
    detectSessionInUrl: false,

    storage: window.localStorage,
    flowType: 'pkce',
  },
  global: {
    headers: {
      'x-application-name': 'mercado-local',
    },
  },
})

// =====================
// SUPABASE GUEST (loja/checkout/histórico sem login)
// - Não usa sessão
// - Sempre envia x-guest-token
// =====================
export const supabaseGuest = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    headers: {
      'x-application-name': 'mercado-local',
      'x-guest-token': getOrCreateGuestToken(),
    },
  },
})

// Se em algum momento você quiser “resetar” o token do cliente:
export function resetGuestToken() {
  try {
    localStorage.removeItem(GUEST_TOKEN_KEY)
    return getOrCreateGuestToken()
  } catch {
    return getOrCreateGuestToken()
  }
}

// (Opcional) helper de teste — não use em produção para tabela sensível se RLS estiver ativa.
export const testConnection = async () => {
  try {
    const { error } = await supabase.from('produtores').select('id').limit(1)
    if (error) throw error
    return true
  } catch (error) {
    console.error('❌ Erro na conexão com Supabase:', error)
    return false
  }
}
