import { defineConfig, loadEnv, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { build as buildWorker } from 'esbuild'
import { handleGeminiRequest } from './server/geminiWorker'

export default defineConfig(({ mode }) => {
  const values = loadEnv(mode, process.cwd(), '')
  let outputDir = 'dist'
  const geminiProxy: Plugin = {
    name: 'gemini-cloudflare-proxy',
    configResolved(config) { outputDir = config.build.outDir },
    configureServer(server) {
      server.middlewares.use('/api/gemini', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
        const request = new Request('http://localhost/api/gemini', {
          method: req.method, headers,
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          duplex: 'half'
        } as RequestInit & { duplex: 'half' })
        const response = await handleGeminiRequest(request, values.GEMINI_API_KEY || '', values.VITE_FIREBASE_API_KEY || '', values.VITE_GEMINI_MODEL || 'gemini-3.8-flash')
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(Buffer.from(await response.arrayBuffer()))
      })
    },
    async closeBundle() {
      await buildWorker({
        entryPoints: ['server/geminiWorker.ts'], outfile: `${outputDir}/_worker.js`,
        bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
        define: {
          __EMBEDDED_GEMINI_KEY__: JSON.stringify(values.GEMINI_API_KEY || ''),
          __FIREBASE_WEB_API_KEY__: JSON.stringify(values.VITE_FIREBASE_API_KEY || ''),
          __GEMINI_MODEL__: JSON.stringify(values.VITE_GEMINI_MODEL || 'gemini-3.8-flash')
        }
      })
    }
  }
  return {
  plugins: [
    preact(),
    geminiProxy,
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'Plan',
        short_name: 'Plan',
        description: 'A fast, offline-first month calendar for planning your days.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['_worker.js'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'style' || request.destination === 'script',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'assets-cache' }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  build: {
    target: 'es2020',
    cssCodeSplit: true
  }
  }
})
