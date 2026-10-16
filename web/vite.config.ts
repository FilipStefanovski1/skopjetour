import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'statues.geojson', 'themes.json'],
      manifest: {
        name: 'Skopje Statues',
        short_name: 'Statues',
        description: 'Your personal guide to the statues of Skopje',
        lang: 'mk',
        theme_color: '#1f2a37',
        background_color: '#f6f3ee',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,geojson}'],
        runtimeCaching: [
          {
            // Map tiles the visitor has already seen stay available offline.
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: { cacheName: 'tiles', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//,
            handler: 'CacheFirst',
            options: { cacheName: 'photos', expiration: { maxEntries: 300 } },
          },
          {
            urlPattern: /^https:\/\/(mk|en)\.wikipedia\.org\/api\/rest_v1\/page\/summary\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'wiki-summaries', expiration: { maxEntries: 300 } },
          },
        ],
      },
    }),
  ],
})
