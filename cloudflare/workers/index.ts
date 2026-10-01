/**
 * Cloudflare Worker for Moneo
 * - Serves static files from R2 with edge caching & SPA routing
 * - Handles Lemon Squeezy billing webhooks to update user subscriptions in Supabase
 *
 * Security (audit hardening):
 * - CORS is allowlisted (never `*`), keyed off the Origin header.
 * - The Lemon Squeezy webhook FAILS CLOSED: without the HMAC secret the
 *   endpoint refuses to process, instead of accepting unsigned payloads.
 * - Account deletion derives identity ONLY from the caller's JWT verified
 *   against Supabase Auth; client-supplied user ids are ignored.
 */

import { handleAccountDelete } from './account';
import { handleEvent, type AnalyticsDataset } from './events';
import { handleLemonSqueezyWebhook } from './lemonWebhook';
import { handleCustomerPortal } from './portal';
import { handleRankDiscount, type DiscountKV } from './discount';
import { handleAIPlan } from './ai';
import {
  handleCalendarConnect,
  handleCalendarDisconnect,
  handleCalendarEvents,
  handleCalendarStatus,
} from './calendar';
import {
  handleBuddyInvite,
  handleBuddyJoin,
  handleBuddyStatus,
  handleBuddyUnpair,
} from './focusBuddy';
import { handleSyncRecords } from './proSync';
import {
  buildSecurityHeaders,
  clientIp,
  createRateLimiter,
  mergeHeaders,
  canonicalRedirect,
} from './security';
import {
  getCacheControl,
  getContentType,
  isKnownClientRoute,
  isStaticAssetPath,
} from './staticAssetPath';

export { isStaticAssetPath } from './staticAssetPath';

/** Best-effort per-isolate guards (see security.ts for the caveat). */
const webhookLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });
const accountLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
/** Connect/disconnect are rare; events is polled more often while viewing the calendar. */
const calendarLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const calendarEventsLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
const buddyLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
/** Pro sync pushes are debounced client-side; a first upload is a handful of batches. */
const syncLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
/** Status is read on two screens; minting happens at most once per offer. */
const discountLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

const SEC = buildSecurityHeaders();

/** Presence-only env summary for /api/health. Never throws, never leaks values. */
export function buildHealthBody(env: Env): { ok: true; env: Record<string, boolean> } {
  return {
    ok: true,
    env: {
      supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
      lemonSqueezy: Boolean(env.LEMON_SQUEEZY_WEBHOOK_SECRET),
      ai: Boolean(env.AI_API_KEY),
    },
  };
}

function api(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(SEC, { 'Content-Type': 'application/json' }),
  });
}

export interface Env {
  R2_BUCKET?: any;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LEMON_SQUEEZY_WEBHOOK_SECRET?: string;
  LEMON_SQUEEZY_API_KEY?: string;
  AI_API_KEY?: string;
  AI_DAILY_LIMIT?: string;
  /** Workers Analytics Engine dataset for anonymous funnel counters (optional). */
  EVENTS?: AnalyticsDataset;
  AI_MODEL?: string;
  /** Comma-separated list of allowed front-end origins. */
  CORS_ORIGINS?: string;
  /** Reused from the existing Google Sign-In OAuth client — not a new app. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Comma-separated emails with Free branding + Pro unlock (not Lemon-paid). */
  PRO_COMPLIMENTARY_EMAILS?: string;
  /** Comma-separated Lemon variant/product ids per interval (public, not secrets). */
  LEMON_YEARLY_IDS?: string;
  LEMON_MONTHLY_IDS?: string;
  /** "true" lets Lemon test-mode webhooks grant Pro; anything else ignores them. */
  ALLOW_TEST_MODE?: string;
  /** Lemon store + monthly numeric variant id the rank discount codes are created for (public). */
  LEMON_STORE_ID?: string;
  LEMON_MONTHLY_VARIANT_ID?: string;
  KV_CACHE?: DiscountKV;
}

const DEFAULT_ALLOWED_ORIGINS = 'https://moneo.bond';

function allowedOrigins(env: Env): string[] {
  const raw = env.CORS_ORIGINS || DEFAULT_ALLOWED_ORIGINS;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Returns a per-request CORS header set, or null when the origin is allowed. */
function corsFor(request: Request, env: Env): Record<string, string> | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = allowedOrigins(env);
  if (!allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const canonical = canonicalRedirect(url);
    if (canonical) {
      return new Response(null, {
        status: 301,
        headers: mergeHeaders(SEC, { Location: canonical }),
      });
    }
    const cors = corsFor(request, env);

    // Preflight for the allowed origin only.
    if (request.method === 'OPTIONS') {
      if (!cors) {
        return new Response(null, { status: 403, headers: { ...SEC } });
      }
      return new Response(null, { headers: mergeHeaders(SEC, cors) });
    }

    // Faza 5A: per-IP rate limits on state-changing APIs (429 + Retry-After).
    if (url.pathname.startsWith('/api/')) {
      const limiter =
        url.pathname === '/api/account/delete'
          ? accountLimiter
          : url.pathname === '/api/calendar/events'
            ? calendarEventsLimiter
            : url.pathname.startsWith('/api/calendar/')
              ? calendarLimiter
              : url.pathname.startsWith('/api/buddy/')
                ? buddyLimiter
                : url.pathname === '/api/sync/records'
                  ? syncLimiter
                  : url.pathname === '/api/billing/discount'
                    ? discountLimiter
                    : webhookLimiter;
      if (!limiter(`${clientIp(request)}:${url.pathname}`)) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: mergeHeaders(SEC, {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          }),
        });
      }
    }

    // Health check (Faza 32c): public, unauthenticated, presence-only —
    // never leaks secret values, just whether each integration is wired.
    if (url.pathname === '/api/health') {
      return api(buildHealthBody(env), 200);
    }

    // Anonymous funnel counters: allowlisted names only, always 204.
    if (url.pathname === '/api/event') {
      return handleEvent(request, env);
    }

    // Webhook endpoint for Lemon Squeezy billing events (server-to-server,
    // no CORS required). Tampered/short-circuited signatures are rejected.
    if (url.pathname === '/api/webhook/lemonsqueezy' && request.method === 'POST') {
      return handleLemonSqueezyWebhook(request, env);
    }

    // Authenticated account deletion (Faza 0.1). Identity comes only from
    // the caller's JWT, verified server-side against Supabase Auth.
    if (url.pathname === '/api/account/delete') {
      return handleAccountDelete(request, env);
    }

    // Customer Portal session for self-serve cancel/upgrade/downgrade.
    // Same-origin, JWT-gated; the Lemon Squeezy API key never leaves the Worker.
    if (url.pathname === '/api/billing/portal') {
      return handleCustomerPortal(request, env);
    }

    // Rank discount codes: JWT-gated, rank recomputed from synced data,
    // one first-month code per account. 503 `not_configured` without the Lemon key.
    if (url.pathname === '/api/billing/discount') {
      return handleRankDiscount(request, env);
    }

    // Server-side AI planner (Faza 6): JWT-gated, rate-limited, audited.
    // Fail-closed without AI_API_KEY; the browser never holds a model key.
    if (url.pathname === '/api/ai/plan') {
      return handleAIPlan(request, env);
    }

    // Read-only Google Calendar integration (Faza 10). Identity from JWT
    // only; the refresh token never reaches the client.
    if (url.pathname === '/api/calendar/connect') {
      return handleCalendarConnect(request, env);
    }
    if (url.pathname === '/api/calendar/status') {
      return handleCalendarStatus(request, env);
    }
    if (url.pathname === '/api/calendar/events') {
      return handleCalendarEvents(request, env);
    }
    if (url.pathname === '/api/calendar/disconnect') {
      return handleCalendarDisconnect(request, env);
    }

    // Focus buddy (Faza 25): one paired user sees only the other's
    // today-focused minutes, never a feed or history. Pro-gated server-side.
    if (url.pathname === '/api/buddy/invite') return handleBuddyInvite(request, env);
    if (url.pathname === '/api/buddy/join') return handleBuddyJoin(request, env);
    if (url.pathname === '/api/buddy/unpair') return handleBuddyUnpair(request, env);
    if (url.pathname === '/api/buddy/status') return handleBuddyStatus(request, env);

    // Pro full-data sync write path: JWT identity, server-side Pro check,
    // newest-wins upsert. Reads go through the RLS-scoped client.
    if (url.pathname === '/api/sync/records') return handleSyncRecords(request, env);

    // Determine file path from URL
    let filePath = url.pathname;
    if (filePath === '/' || filePath === '') {
      filePath = '/index.html';
    }

    // Remove leading slash for R2
    const r2Key = filePath.startsWith('/') ? filePath.slice(1) : filePath;

    // Try to get file from R2
    const object = await env.R2_BUCKET?.get(r2Key);

    if (object) {
      return new Response(object.body, {
        headers: mergeHeaders(SEC, cors, {
          'Content-Type': getContentType(filePath),
          // index.html + SW + manifest must revalidate so clients pick up
          // new builds; hashed assets stay immutable.
          'Cache-Control': getCacheControl(filePath),
        }),
      });
    }

    // Missing hashed assets must be real 404s — never HTML. Returning index.html
    // for `/assets/*.js` makes the browser try to execute HTML as a module →
    // blank/black screen (dark body bg, empty #root).
    if (isStaticAssetPath(filePath)) {
      return new Response(`Not Found. Tried to fetch: ${r2Key}`, {
        status: 404,
        headers: mergeHeaders(SEC, cors, {
          'Cache-Control': 'no-store',
        }),
      });
    }

    // SPA fallback: return index.html for client routes (e.g. /privacy, /terms).
    // Unknown paths still get the shell (the app renders), but as a 404.
    const indexObject = await env.R2_BUCKET?.get('index.html');
    if (indexObject) {
      return new Response(indexObject.body, {
        status: isKnownClientRoute(url.pathname) ? 200 : 404,
        headers: mergeHeaders(SEC, cors, {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=0, must-revalidate',
        }),
      });
    }

    return new Response(`Not Found. Tried to fetch: ${r2Key}`, {
      status: 404,
      headers: mergeHeaders(SEC, cors),
    });
  },
};
