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
// - Nunca lê localStorage (evita virar authenticated sem querer)
// - Sempre envia x-guest-token
// =====================

const memoryStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
  }
})()

export const supabaseGuest = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storage: memoryStorage as any,
    storageKey: 'ml_guest_auth', // evita colisão com o supabase normal
  },
  global: {
    headers: {
      'x-application-name': 'mercado-local',
      'x-guest-token': getOrCreateGuestToken(),
    },
  },
})

