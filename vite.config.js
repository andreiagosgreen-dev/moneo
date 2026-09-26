import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['*.svg', '*.png', '*.jpg', '*.jpeg', '*.ico', 'brand/*.png'],
      manifest: {
        id: '/',
        name: 'Moneo - Focus Timer',
        short_name: 'Moneo',
        description:
          'A calm focus companion for intentional work, structured breaks, and consistent progress.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        theme_color: '#0d1310',
        background_color: '#0d1310',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
        categories: ['productivity', 'utilities'],
        shortcuts: [
          {
            name: 'Start Focus',
            short_name: 'Focus',
            description: 'Start a focus session',
            url: '/?action=focus',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Do NOT precache woff/woff2 — Pro font packs balloon precache to ~10MB
        // and can break SW install / leave a stuck black shell after deploy.
        // Fonts still load on demand with long-cache hashed URLs from R2.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['**/*.{woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/');
          if (
            norm.includes('@lemonsqueezy/lemonsqueezy.js') ||
            norm.includes('/src/lib/billing/')
          ) {
            return 'billing';
          }
          if (norm.includes('/src/lib/assistant.ts') || norm.includes('/src/lib/ai/')) {
            return 'ai-assistant';
          }
          if (norm.includes('/src/components/CalendarCard.tsx')) {
            return 'calendar';
          }
          if (norm.includes('node_modules')) {
            return 'vendor';
          }
          return null;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
