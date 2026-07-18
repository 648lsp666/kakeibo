import { describe, expect, it } from 'vitest'
import { createRuntimeCaching } from './pwa-cache'

describe('PWA runtime cache policy', () => {
  it('keeps every Supabase endpoint network-only ahead of generic HTTPS caching', () => {
    const rules = createRuntimeCaching('https://project.supabase.co')
    expect(rules[0].handler).toBe('NetworkOnly')
    const matchSupabase = rules[0].urlPattern
    expect(matchSupabase).toBeTypeOf('function')
    if (matchSupabase instanceof RegExp) throw new Error('Supabase rule must use an origin matcher')
    expect(matchSupabase({ url: new URL('https://project.supabase.co/storage/v1/object/authenticated/bill') })).toBe(true)
    expect(matchSupabase({ url: new URL('https://other.example.com/api') })).toBe(false)
    expect(rules[1]).toMatchObject({ handler: 'NetworkFirst', options: { cacheName: 'api-cache' } })
  })

  it('falls back to generic HTTPS caching when Supabase is not configured', () => {
    expect(createRuntimeCaching(undefined)).toHaveLength(1)
    expect(createRuntimeCaching('not-a-url')[0].handler).toBe('NetworkFirst')
  })
})
