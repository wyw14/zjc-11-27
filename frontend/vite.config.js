import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 4526,
    proxy: {
      '/api': {
        target: 'http://localhost:4026',
        changeOrigin: true
      }
    }
  }
})
