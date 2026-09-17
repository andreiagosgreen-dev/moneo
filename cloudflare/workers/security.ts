/**
 * Edge security primitives (Faza 5A defense-in-depth).
 *
 * Pure functions only — no platform APIs beyond Request/Headers types —
 * so the root vitest suite can exercise them without a Worker runtime.
 * Per-isolate note: the in-memory rate limiter and deduper are best-effort
 * (each isolate keeps its own counters); they bound abuse, they do not
 * replace provider-level WAF rules.
 */

/** Refuse webhook bodies above this size before parsing. */
export const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

/**
 * Response headers applied to every Worker response (static assets, SPA
 * fallback and JSON APIs alike).
 *
 * CSP is tuned to the actual bundle: same-origin scripts, Google Fonts
 * stylesheets + font files, self/data/blob images, Supabase + Lemon
 * Squeezy connections. Microphone is deliberately NOT denied — voice
 * input (Web Speech API) is a feature. Custom-domain self-hosted
 * Supabase needs its host added to connect-src.
 */
export function buildSecurityHeaders(): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.lemonsqueezy.com",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), payment=(), usb=(), bluetooth=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // Legacy defense-in-depth alongside frame-ancestors 'none'.
    'X-Frame-Options': 'DENY',
  };
}

/** Merge header records left-to-right; later values win. */
export function mergeHeaders(
  ...parts: Array<Record<string, string> | undefined | null>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of parts) {
    if (!part) continue;
    for (const key of Object.keys(part)) out[key] = part[key];
  }
  return out;
}

/** Best-effort client identity for rate limiting (Cloudflare-aware). */
export function clientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf && cf.trim()) return cf.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded && forwarded.trim()) return forwarded.split(',')[0].trim();
  return 'unknown';
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

/**
 * Sliding-window limiter. Returns true when the call is allowed.
 * `now` is injectable so tests are deterministic.
 */
export function createRateLimiter(config: RateLimitConfig): (key: string, now?: number) => boolean {
  const { windowMs, max } = config;
  const hits = new Map<string, number[]>();
  return (key: string, now: number = Date.now()): boolean => {
    const cutoff = now - windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (times.length === 0 || times[times.length - 1] <= cutoff) hits.delete(k);
      }
    }
    return true;
  };
}

/**
 * Replay best-effort deduper: first sighting of a key inside the TTL
 * returns true, repeats return false. Webhook (event_name + data.id)
 * replays therefore apply once per isolate.
 */
export function createDeduper(
  ttlMs: number,
  maxKeys = 5000,
): (key: string, now?: number) => boolean {
  const seen = new Map<string, number>();
  return (key: string, now: number = Date.now()): boolean => {
    const prev = seen.get(key);
    if (prev !== undefined && now - prev < ttlMs) return false;
    seen.set(key, now);
    if (seen.size > maxKeys) {
      const cutoff = now - ttlMs;
      for (const [k, ts] of seen) {
        if (ts <= cutoff) seen.delete(k);
        if (seen.size <= maxKeys) break;
      }
    }
    return true;
  };
}

/**
 * Cheap pre-read body guard from Content-Length. Chunked/lying senders
 * are caught by the post-read length check in the handler.
 */
export function declaredBodyTooLarge(request: Request, maxBytes: number): boolean {
  const declared = request.headers.get('content-length');
  if (declared === null) return false;
  const n = Number(declared);
  return Number.isFinite(n) && n > maxBytes;
}
