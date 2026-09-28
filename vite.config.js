import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Above-the-fold faces on the landing: hero title (Literata 600) and body copy
// (Inter 400). Latin subset only — other subsets still load via unicode-range.
const PRELOAD_FONTS = [
  /\/literata-latin-600-normal-[\w-]+\.woff2$/,
  /\/inter-latin-400-normal-[\w-]+\.woff2$/,
];

function preloadLandingFonts() {
  let base = '/';
  return {
    name: 'moneo-preload-landing-fonts',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return [];
        const files = Object.keys(ctx.bundle);
        return PRELOAD_FONTS.flatMap((re) => {
          const file = files.find((f) => re.test(`/${f}`));
          if (!file) return [];
          return [
            {
              tag: 'link',
              attrs: {
                rel: 'preload',
                as: 'font',
                type: 'font/woff2',
                href: `${base}${file}`,
                crossorigin: '',
              },
              injectTo: 'head',
            },
          ];
        });
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    preloadLandingFonts(),
    VitePWA({
      registerType: 'autoUpdate',
      // includeAssets / manifest icons bypass workbox.globIgnores, so only list
      // what globPatterns below cannot pick up (the .ico favicon).
      includeAssets: ['*.ico'],
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Moneo - Focus Timer',
        short_name: 'Moneo',
        description:
          'A calm focus companion for intentional work, structured breaks, and consistent progress.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        theme_color: '#0f1117',
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
        // Brand artwork (1200px logos, Lemon covers, store header) and og.png
        // are multi-MB and not needed offline; the nav mark is runtime-cached.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['**/*.{woff,woff2}', 'brand/*-1200.png', 'brand/*-1600x300.png', 'og.png'],
        runtimeCaching: [
          {
            urlPattern: /\/brand\/.*\.png$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'brand-images-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Same-origin Fontsource woff2 (excluded from precache intentionally —
          // see PR #53). CacheFirst so offline still gets fonts after first visit.
          {
            urlPattern: /\/assets\/.*\.woff2?$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fontsource-fonts-cache',
              expiration: {
                maxEntries: 40,
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
        // Shared helpers (storage, preload) must not be pulled into a manual
        // chunk just because it uses them — the entry would then load it too.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/');
          // Landing-page imports (display prices, font CSS) stay with whoever
          // imports them, so first-time visitors don't download the app.
          if (norm.endsWith('/src/lib/billing/prices.ts') || norm.includes('/@fontsource/')) {
            return null;
          }
          // The other locales split on their own (dynamic imports); English is
          // also imported statically, so pin it to one chunk the landing can load.
          if (norm.endsWith('/src/lib/i18n/locales/en.ts')) {
            return 'locale-en';
          }
          if (
            norm.includes('@lemonsqueezy/lemonsqueezy.js') ||
            norm.includes('/src/lib/billing/')
          ) {
            return 'billing';
          }
          if (norm.includes('/node_modules/@supabase/')) {
            return 'supabase';
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
  // Without explicit entries, the dep optimizer globs **/*.html and would crawl
  // nested agent worktrees (.claude/worktrees/*) with their own stale src/.
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
    watch: {
      ignored: ['**/.claude/worktrees/**'],
    },
  },
});
