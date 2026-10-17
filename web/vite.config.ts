import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// `npm run dev:phone` serves over HTTPS on the network: phones only share location, the camera
// and NFC with secure pages. The certificate is self-signed, so the phone asks once to trust it.
export default defineConfig(({ mode }) => ({
  plugins: [
    mode === 'phone' && basicSsl({ name: 'skopje-statues' }),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'robots.txt', 'statues.geojson', 'themes.json'],
      manifest: {
        name: 'Skopje Statues',
        short_name: 'Statues',
        description: 'Your personal guide to the statues of Skopje',
        lang: 'mk',
        theme_color: '#f4f4f9',
        background_color: '#f4f4f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Full-bleed for Android's round and squircle masks.
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // .mjs is MapLibre's worker: without it the map is blank offline.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,json,geojson,woff2}'],
        runtimeCaching: [
          {
            // Vector tiles and map fonts the visitor has already seen stay available offline.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(planet\/|fonts\/)/,
            handler: 'CacheFirst',
            options: { cacheName: 'map', expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            // Statue photos are cross-origin <img>s, so their responses are opaque (status 0).
            urlPattern: /^https:\/\/(commons|upload)\.wikimedia\.org\//,
            handler: 'CacheFirst',
            options: { cacheName: 'photos', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 300 } },
          },
          {
            // 3D models: fetched the first time a statue is opened, then kept for offline.
            urlPattern: /\/models\/.*\.glb$/,
            handler: 'CacheFirst',
            options: { cacheName: 'models', expiration: { maxEntries: 10 } },
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
}))
