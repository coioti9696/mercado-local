import { createClient } from '@supabase/supabase-js'

// Pegar variáveis do ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Log para debug (remover depois)
console.log('🔧 Supabase Config:')
console.log('URL:', supabaseUrl ? '✅ Presente' : '❌ Faltando')
console.log('Key:', supabaseAnonKey ? '✅ Presente' : '❌ Faltando')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERRO: Variáveis do Supabase não encontradas no .env')
  console.error('Verifique se seu arquivo .env tem:')
  console.error('VITE_SUPABASE_URL=https://...')
  console.error('VITE_SUPABASE_ANON_KEY=sb_publishable_...')
}

// ✅ Criar cliente do Supabase (CONFIGURAÇÃO CORRETA PARA SPA)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,

    /**
     * ✅ IMPORTANTE:
     * Agora o fluxo de convite é tratado manualmente no /convite
     * usando exchangeCodeForSession(code).
     * Se deixar TRUE aqui, o Supabase pode “pegar” sessão em rotas erradas
     * e reutilizar sessão antiga -> dashboard do produtor errado.
     */
    detectSessionInUrl: false,

    // ✅ Força uso do localStorage (SPA)
    storage: window.localStorage,

    // ✅ Recomendado para SPA moderna (convites/magic-link usam PKCE)
    flowType: 'pkce',
  },
  global: {
    headers: {
      'x-application-name': 'mercado-local',
    },
  },
})

// Função helper para testes
export const testConnection = async () => {
  try {
    const { error } = await supabase.from('produtores').select('id').limit(1)

    if (error) throw error

    console.log('✅ Conexão com Supabase estabelecida!')
    return true
  } catch (error) {
    console.error('❌ Erro na conexão com Supabase:', error)
    return false
  }
}
