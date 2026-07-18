interface MatchOptions { url: URL }

export function createRuntimeCaching(supabaseUrl?: string) {
  let supabaseOrigin: string | null = null
  try {
    if (supabaseUrl) supabaseOrigin = new URL(supabaseUrl).origin
  } catch {
    supabaseOrigin = null
  }

  const genericHttps = {
    urlPattern: /^https:\/\//,
    handler: 'NetworkFirst' as const,
    options: { cacheName: 'api-cache', networkTimeoutSeconds: 10 },
  }
  if (!supabaseOrigin) return [genericHttps]
  return [
    {
      urlPattern: ({ url }: MatchOptions) => url.origin === supabaseOrigin,
      handler: 'NetworkOnly' as const,
      options: { cacheName: 'supabase-network-only' },
    },
    genericHttps,
  ]
}
