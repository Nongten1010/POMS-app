import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api-proxy': {
        target: 'http://d-poms.diw.go.th',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, '/api'),
      },
    },
  },
  preview: {
    port: 5174,
    proxy: {
      '/api-proxy': {
        target: 'http://d-poms.diw.go.th',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, '/api'),
      },
    },
  },
})
