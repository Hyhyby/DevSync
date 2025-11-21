import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://commensurately-preflagellate-merissa.ngrok-free.dev',
        changeOrigin: true
      }
    }
  }
})
