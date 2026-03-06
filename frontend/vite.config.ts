import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor-ui': ['lucide-react', 'react-markdown'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/analyze': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/sse': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/report': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      }
    }
  }
})
