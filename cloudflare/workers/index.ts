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
import { classifySubscriptionEvent } from './billing';
import { handleAIPlan } from './ai';
import {
  handleBuddyInvite,
  handleBuddyJoin,
  handleBuddyStatus,
  handleBuddyUnpair,
} from './focusBuddy';
import {
  MAX_WEBHOOK_BODY_BYTES,
  buildSecurityHeaders,
  clientIp,
  createDeduper,
  createRateLimiter,
  declaredBodyTooLarge,
  mergeHeaders,
} from './security';

/** Best-effort per-isolate guards (see security.ts for the caveat). */
const webhookLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });
const accountLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const buddyLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
/** Webhook replay window: same (event, subscription) applies once per hour. */
const webhookDeduper = createDeduper(3_600_000);

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
  AI_API_KEY?: string;
  AI_MODEL?: string;
  /** Comma-separated list of allowed front-end origins. */
  CORS_ORIGINS?: string;
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
      const isAccount = url.pathname === '/api/account/delete';
      const isBuddy = url.pathname.startsWith('/api/buddy/');
      const limiter = isAccount ? accountLimiter : isBuddy ? buddyLimiter : webhookLimiter;
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

    // Server-side AI planner (Faza 6): JWT-gated, rate-limited, audited.
    // Fail-closed without AI_API_KEY; the browser never holds a model key.
    if (url.pathname === '/api/ai/plan') {
      return handleAIPlan(request, env);
    }

    // Focus buddy (Faza 25): one paired user sees only the other's
    // today-focused minutes, never a feed or history. Pro-gated server-side.
    if (url.pathname === '/api/buddy/invite') return handleBuddyInvite(request, env);
    if (url.pathname === '/api/buddy/join') return handleBuddyJoin(request, env);
    if (url.pathname === '/api/buddy/unpair') return handleBuddyUnpair(request, env);
    if (url.pathname === '/api/buddy/status') return handleBuddyStatus(request, env);

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
      const contentType = getContentType(filePath);

      return new Response(object.body, {
        headers: mergeHeaders(SEC, cors, {
          'Content-Type': contentType,
          'Cache-Control':
            filePath === '/index.html'
              ? 'public, max-age=0, must-revalidate'
              : 'public, max-age=31536000, immutable',
        }),
      });
    }

    // SPA fallback: return index.html for client routes (e.g. /privacy, /terms)
    const indexObject = await env.R2_BUCKET?.get('index.html');
    if (indexObject) {
      return new Response(indexObject.body, {
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

async function handleLemonSqueezyWebhook(request: Request, env: Env): Promise<Response> {
  // Fail closed: never process unsigned payloads.
  if (!env.LEMON_SQUEEZY_WEBHOOK_SECRET) {
    return api({ error: 'Webhook not configured' }, 503);
  }

  // Faza 5A: cheap pre-read size gate (chunked/lying senders are re-checked
  // after the read below).
  if (declaredBodyTooLarge(request, MAX_WEBHOOK_BODY_BYTES)) {
    return api({ error: 'Payload too large' }, 413);
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
    return api({ error: 'Payload too large' }, 413);
  }
  const signature = request.headers.get('x-signature');

  const isValid = await verifyLemonSqueezySignature(
    rawBody,
    signature,
    env.LEMON_SQUEEZY_WEBHOOK_SECRET,
  );
  if (!isValid) {
    return api({ error: 'Invalid signature' }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return api({ error: 'Invalid JSON' }, 400);
  }

  // Faza 0.3: only subscription-lifecycle events may write. Malformed
  // payloads are rejected (not retryable); anything else is acknowledged
  // without side effects so retries stay idempotent.
  const classified = classifySubscriptionEvent(payload);
  if (classified.action === 'reject') {
    return api({ error: classified.reason ?? 'Invalid payload' }, 400);
  }

  const eventName = payload?.meta?.event_name;
  if (classified.action === 'ignore') {
    return api({ ok: true, ignored: eventName }, 200);
  }

  // Faza 5A: replay best-effort — the same (event, subscription) applies
  // once per window even if Lemon Squeezy (or an attacker replaying a
  // captured valid request) delivers it again.
  const subscriptionRef = String(payload?.data?.id ?? '');
  if (!webhookDeduper(`${eventName}:${subscriptionRef}`)) {
    return api({ ok: true, deduped: true }, 200);
  }

  const customData = payload?.meta?.custom_data;
  const userId = customData?.user_id;

  if (!userId) {
    return api({ ok: true, message: 'No custom user_id in payload, skipping' }, 200);
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    // Logged by the platform; respond 500 so the sender retries once
    // the service role credentials are provisioned.
    return api({ error: 'Database not configured' }, 500);
  }

  const data = payload?.data;
  const attrs = data?.attributes || {};
  const status = attrs.status || 'active';
  const variantName = (attrs.variant_name || '').toLowerCase();
  const planId = variantName.includes('year') ? 'pro-yearly' : 'pro-monthly';
  const currentPeriodEnd = attrs.renews_at || attrs.ends_at || null;

  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: userId,
        lemon_customer_id: String(attrs.customer_id || ''),
        lemon_subscription_id: String(data?.id || ''),
        status: status === 'active' || status === 'on_trial' ? 'active' : status,
        plan_id: planId,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      // Faza 5A: never echo upstream bodies to the webhook caller.
      return api({ error: 'Upstream update failed' }, 500);
    }
  } catch {
    return api({ error: 'Database error' }, 500);
  }

  return api({ ok: true, event: eventName, user_id: userId }, 200);
}

async function verifyLemonSqueezySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = new Uint8Array(
      signatureHeader.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
    );
    return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(rawBody));
  } catch {
    return false;
  }
}

function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    svg: 'image/svg+xml',
    woff2: 'font/woff2',
    webmanifest: 'application/manifest+json',
  };
  return contentTypes[ext || ''] || 'application/octet-stream';
}
