import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    headers: {
      'Permissions-Policy': 'microphone=(self), camera=(self), geolocation=(self)'
    }
  },
  build: {
    // Target modern browsers for smaller output
    target: 'es2020',
    // Chunk size warning at 300KB to catch large chunks early
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        // Manual chunk splitting: separate vendors and features
        manualChunks: {
          // Core dependencies
          'chunk-vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            '@supabase/supabase-js'
          ],
          // UI & Animation libraries
          'chunk-ui': [
            'framer-motion',
            'lucide-react',
            'react-hot-toast',
            'tailwind-merge',
            'clsx'
          ],
          // Data visualization (lazy-loaded)
          'chunk-charts': [
            'chart.js',
            'react-chartjs-2'
          ],
          // PDF & Document generation (lazy-loaded)
          'chunk-pdf': [
            'jspdf',
            'jspdf-autotable',
            'react-pdf'
          ],
          // Database & Storage
          'chunk-storage': [
            'sql.js',
            'localforage',
            'browser-image-compression'
          ],
          // QR Code (lazy-loaded)
          'chunk-qr': [
            'qrcode',
            'qrcode.react'
          ]
        },
        // Asset hashing for better caching
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'sql-wasm.wasm'],
      manifest: {
        name: 'Dukan Sathi - Voice-First Shop Management',
        short_name: 'Dukan Sathi',
        description: 'Premium shop management with voice-first interface and local-first storage.',
        theme_color: '#4f46e5',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
})
