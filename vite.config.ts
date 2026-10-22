import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Load the project PORT so the API proxy follows the backend configuration.
const env = loadEnv('development', process.cwd(), '');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/favicon.svg',
        'icons/favicon.png',
        'icons/apple-touch-icon.png',
        'icons/apple-touch-icon.svg',
      ],
      manifest: {
        name: 'PharmaChain',
        short_name: 'PharmaChain',
        description: 'Pharmacy Supply Chain Management System',
        theme_color: '#4f46e5',
        background_color: '#eef2ff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'en',
        categories: ['health', 'medical', 'business', 'productivity'],
        icons: [
          { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
          { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,woff,ttf}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // allow bundles up to 5 MiB
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  define: {
    // Build stamp surfaced in the console so a stale-cached client is easy
    // to identify when debugging "works here but not there" reports.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // Pin the dev server to an unused port so it never collides with another
    // Vite instance (5173-5175 are often occupied). Override with
    // `vite --port <n>`; PHARMACHAIN_API_PORT keeps the proxy in lockstep if
    // scripts/dev/dev-server-unused.mjs could not take the default backend port.
    port: 5176,
    strictPort: true,
    // Proxy API calls to the Express backend (MongoDB) on :41837 by default. The SPA
    // pages live at /verify, /track and /transport (client-side routes for
    // the QR 1 / QR 2 deep links) — they are NOT proxied, so full-page loads
    // reach the React app, not the backend.
    proxy: {
      '/api': {
        target: `http://localhost:${env.PHARMACHAIN_API_PORT || env.PORT || 41837}`,
        changeOrigin: true,
      },
    },
  },
});
