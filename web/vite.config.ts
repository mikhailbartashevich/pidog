import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pidogProxy = {
  '/pidog-api': {
    target: 'http://192.168.1.37:8765',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/pidog-api/u, ''),
  },
  '/pidog-camera': {
    target: 'http://192.168.1.37:9000',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/pidog-camera/u, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: pidogProxy,
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: pidogProxy,
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@mui/') || id.includes('/node_modules/@emotion/')) {
            return 'mui'
          }
          if (id.includes('/node_modules/react')) return 'react'
          return undefined
        },
      },
    },
  },
})
