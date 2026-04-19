import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * In dev we don't have the Vercel Edge runtime, so `/api/claude` would 404. To make
 * the proxy path work locally too, we forward `/api/claude` to Anthropic and inject
 * the API key from the environment so the browser never sees it. Priority:
 *   1. ANTHROPIC_API_KEY (same name used in production)
 *   2. VITE_ANTHROPIC_API_KEY (already defined by some local setups)
 *
 * If neither is set, the proxy is not registered; the client will see a proper
 * "not configured" fallback instead of an opaque Anthropic auth error.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const serverKey = (env.ANTHROPIC_API_KEY || env.VITE_ANTHROPIC_API_KEY || '').trim()
  const hasKey = serverKey && !/REPLACE_ME|your_api_key_here/i.test(serverKey) && serverKey.length >= 20

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: hasKey
        ? {
            '/api/claude': {
              target: 'https://api.anthropic.com',
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api\/claude/, '/v1/messages'),
              configure: (proxy) => {
                proxy.on('proxyReq', (proxyReq) => {
                  proxyReq.setHeader('x-api-key', serverKey)
                  proxyReq.setHeader('anthropic-version', '2023-06-01')
                })
              },
            },
          }
        : {},
    },
  }
})
