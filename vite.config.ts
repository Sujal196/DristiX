import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Proxy the API in development so the browser makes same-origin requests.
      // This sidesteps CORS entirely and keeps cookies working.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY ?? 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  }
})
