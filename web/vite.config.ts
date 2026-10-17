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
      includeAssets: ['icon.svg', 'statues.geojson', 'themes.json'],
      manifest: {
        name: 'Skopje Statues',
        short_name: 'Statues',
        description: 'Your personal guide to the statues of Skopje',
        lang: 'mk',
        theme_color: '#f4f4f9',
        background_color: '#f4f4f9',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,geojson,woff2}'],
        runtimeCaching: [
          {
            // Vector tiles and map fonts the visitor has already seen stay available offline.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(planet\/|fonts\/)/,
            handler: 'CacheFirst',
            options: { cacheName: 'map', expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 } },
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
}))
