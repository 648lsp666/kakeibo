import { describe, expect, it } from 'vitest'
import { requireSupabaseConfig } from './supabase-client'

describe('requireSupabaseConfig', () => {
  it('rejects a missing URL or anon key', () => {
    expect(() => requireSupabaseConfig({})).toThrow('云同步尚未配置')
  })

  it('accepts only an HTTPS production URL', () => {
    expect(() => requireSupabaseConfig({
      VITE_SUPABASE_URL: 'http://cloud.example.com',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
      DEV: false,
    })).toThrow('Supabase 生产地址必须使用 HTTPS')
  })

  it('allows the local Supabase URL in development', () => {
    expect(requireSupabaseConfig({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
      DEV: true,
    })).toEqual({ url: 'http://127.0.0.1:54321', anonKey: 'anon-key' })
  })
})
