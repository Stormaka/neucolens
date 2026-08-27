import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  // #24: Code splitting — split vendor bundles for better caching
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui':     ['lucide-react'],
          'vendor-data':   ['axios', 'd3'],
          'vendor-editor': ['@uiw/react-codemirror', '@codemirror/lang-cpp', '@codemirror/theme-one-dark'],
        }
      }
    }
  }
})
