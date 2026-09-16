/**
 * Cloudflare Worker for Moneo
 * - Serves static files from R2 with edge caching & SPA routing
 * - Handles Lemon Squeezy billing webhooks to update user subscriptions in Supabase
 *
 * Security (audit hardening):
 * - CORS is allowlisted (never `*`), keyed off the Origin header.
 * - The Lemon Squeezy webhook FAILS CLOSED: without the HMAC secret the
 *   endpoint refuses to process, instead of accepting unsigned payloads.
 */

export interface Env {
  R2_BUCKET?: any;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LEMON_SQUEEZY_WEBHOOK_SECRET?: string;
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
        return new Response(null, { status: 403 });
      }
      return new Response(null, { headers: cors });
    }

    // Webhook endpoint for Lemon Squeezy billing events (server-to-server,
    // no CORS required). Tampered/short-circuited signatures are rejected.
    if (url.pathname === '/api/webhook/lemonsqueezy' && request.method === 'POST') {
      return handleLemonSqueezyWebhook(request, env);
    }

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
        headers: {
          ...(cors || {}),
          'Content-Type': contentType,
          'Cache-Control':
            filePath === '/index.html'
              ? 'public, max-age=0, must-revalidate'
              : 'public, max-age=31536000, immutable',
        },
      });
    }

    // SPA fallback: return index.html for client routes (e.g. /privacy, /terms)
    const indexObject = await env.R2_BUCKET?.get('index.html');
    if (indexObject) {
      return new Response(indexObject.body, {
        headers: {
          ...(cors || {}),
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=0, must-revalidate',
        },
      });
    }

    return new Response(`Not Found. Tried to fetch: ${r2Key}`, {
      status: 404,
      headers: cors || {},
    });
  },
};

async function handleLemonSqueezyWebhook(request: Request, env: Env): Promise<Response> {
  // Fail closed: never process unsigned payloads.
  if (!env.LEMON_SQUEEZY_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-signature');

  const isValid = await verifyLemonSqueezySignature(
    rawBody,
    signature,
    env.LEMON_SQUEEZY_WEBHOOK_SECRET,
  );
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventName = payload?.meta?.event_name;
  const customData = payload?.meta?.custom_data;
  const userId = customData?.user_id;

  if (!userId) {
    return new Response(
      JSON.stringify({ ok: true, message: 'No custom user_id in payload, skipping' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    // Logged by the platform; respond 500 so the sender retries once
    // the service role credentials are provisioned.
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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
      const errText = await response.text();
      return new Response(JSON.stringify({ error: 'Supabase update failed', details: errText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Database error', message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, event: eventName, user_id: userId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
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
