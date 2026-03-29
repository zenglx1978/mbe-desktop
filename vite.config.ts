import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@main': path.resolve(__dirname, './src/main'),
    },
  },
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: 'https://mbe.hi-maker.com',
        changeOrigin: true,
        secure: true,
      },
      '/governance': {
        target: 'https://mbe.hi-maker.com',
        changeOrigin: true,
        secure: true,
      },
      '/ws': {
        target: 'wss://mbe.hi-maker.com',
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
  },
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
})
