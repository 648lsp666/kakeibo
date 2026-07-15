import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig { url: string; anonKey: string }
type Env = Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY', string>> & { DEV?: boolean }

export function requireSupabaseConfig(env: Env): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) throw new Error('云同步尚未配置')
  const parsed = new URL(url)
  const local = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
  if (!env.DEV && parsed.protocol !== 'https:') {
    throw new Error('Supabase 生产地址必须使用 HTTPS')
  }
  if (env.DEV && parsed.protocol !== 'https:' && !local) {
    throw new Error('开发环境仅允许 HTTPS 或本地 Supabase 地址')
  }
  return { url: parsed.toString().replace(/\/$/, ''), anonKey }
}

let client: SupabaseClient | null = null
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const config = requireSupabaseConfig(import.meta.env)
    client = createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}
