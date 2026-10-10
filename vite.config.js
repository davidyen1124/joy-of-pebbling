import { defineConfig } from 'vite'

export default defineConfig({
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  server: { host: '127.0.0.1' },
})
