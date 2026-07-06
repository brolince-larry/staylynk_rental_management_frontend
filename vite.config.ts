import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Backend origin — falls back to http://127.0.0.1 (port 80, same as APP_URL default)
  const backendOrigin = (() => {
    const raw = env.VITE_API_BASE_URL ?? ''
    if (!raw || raw === 'http://localhost:5173' || raw === 'http://127.0.0.1:5173') {
      return 'http://127.0.0.1'
    }
    try {
      const u = new URL(raw)
      return `${u.protocol}//${u.host}`
    } catch {
      return 'http://127.0.0.1'
    }
  })()

  return {
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Forward all /api requests to the Laravel backend.
      // This catches both absolute-URL mismatches and relative-URL fallbacks.
      '/api': {
        target: backendOrigin,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router-dom')) return 'router'
          if (id.includes('@tanstack/react-query')) return 'query'
          if (id.includes('react-dom') || id.includes('react/')) return 'vendor'
        },
      },
    },
  },
  }
})
