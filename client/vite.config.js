import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dominion City Church',
        short_name: 'DC Church',
        description: 'Membership, check-in, events, and giving for Dominion City Church branches and fellowships.',
        theme_color: '#0a2540',
        background_color: '#f6f9fc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // App shell + static assets — always available offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],

        // Belt-and-suspenders read caching for GET /api/* calls, on top of
        // the IndexedDB layer in lib/db.js. This means a page that hasn't
        // been visited yet still has *something* to show if it's opened
        // for the first time while offline. Writes always go through the
        // outbox in db.js, never through this cache.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api/') && request.method === 'GET',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'api-get-cache' },
          },
        ],
      },
    }),
  ],
});
