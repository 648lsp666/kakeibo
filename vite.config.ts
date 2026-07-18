import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { createRuntimeCaching } from './src/sync/pwa-cache'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM)
  return {
    plugins: [
      react(),
      tailwindcss(),
      !isTauri && VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon-192.png', 'icon-512.png'],
        manifest: {
          name: '家計簿 Kakeibo',
          short_name: 'Kakeibo',
          description: '个人记账本',
          theme_color: '#718b61',
          background_color: '#f7f6ed',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: createRuntimeCaching(env.VITE_SUPABASE_URL),
        },
      }),
    ].filter(Boolean),
    clearScreen: false,
    server: { port: 1420, strictPort: true },
    envPrefix: ['VITE_', 'TAURI_ENV_*'],
    build: {
      target: ['es2021', 'chrome100', 'safari13'],
      minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
  }
})
