import { describe, expect, it } from 'vitest';
import {
  MAX_WEBHOOK_BODY_BYTES,
  buildSecurityHeaders,
  canonicalRedirect,
  clientIp,
  createDeduper,
  createRateLimiter,
  declaredBodyTooLarge,
  mergeHeaders,
} from '../../../cloudflare/workers/security';

/** Minimal Request shape — helpers only touch request.headers.get. */
function req(headers: Record<string, string> = {}): Request {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: { get: (k: string) => lower.get(k.toLowerCase()) ?? null } } as Request;
}

describe('buildSecurityHeaders', () => {
  it('emits the full defense set with a tight CSP', () => {
    const h = buildSecurityHeaders();
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(h['Permissions-Policy']).not.toContain('microphone');
    const csp = h['Content-Security-Policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain('https://*.supabase.co');
    // BYOK Assistant: browser → provider (user's own keys), narrow allowlist.
    expect(csp).toContain('https://generativelanguage.googleapis.com');
    expect(csp).toContain('https://api.openai.com');
    expect(csp).toContain('https://api.deepseek.com');
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('merges left-to-right with later values winning', () => {
    expect(mergeHeaders({ a: '1' }, null, { a: '2', b: '3' })).toEqual({ a: '2', b: '3' });
  });
});

describe('createRateLimiter', () => {
  it('allows max calls per window, then blocks until reset', () => {
    const allow = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(allow('ip', 0)).toBe(true);
    expect(allow('ip', 1)).toBe(true);
    expect(allow('ip', 2)).toBe(true);
    expect(allow('ip', 3)).toBe(false);
    expect(allow('ip', 60_001)).toBe(true);
  });

  it('isolates keys from each other', () => {
    const allow = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(allow('a', 0)).toBe(true);
    expect(allow('a', 1)).toBe(false);
    expect(allow('b', 1)).toBe(true);
  });
});

describe('createDeduper', () => {
  it('applies a key once per TTL, then allows it again', () => {
    const seen = createDeduper(3_600_000);
    expect(seen('sub_created:123', 0)).toBe(true);
    expect(seen('sub_created:123', 1)).toBe(false);
    expect(seen('sub_created:123', 3_600_001)).toBe(true);
    expect(seen('sub_created:456', 2)).toBe(true);
  });
});

describe('clientIp + body guard', () => {
  it('prefers cf-connecting-ip, then x-forwarded-for, then unknown', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '1.2.3.4' }))).toBe('1.2.3.4');
    expect(clientIp(req({ 'x-forwarded-for': '5.6.7.8, 9.9.9.9' }))).toBe('5.6.7.8');
    expect(clientIp(req())).toBe('unknown');
  });

  it('flags oversized declared bodies only', () => {
    expect(declaredBodyTooLarge(req({ 'content-length': '10' }), MAX_WEBHOOK_BODY_BYTES)).toBe(
      false,
    );
    expect(
      declaredBodyTooLarge(
        req({ 'content-length': String(MAX_WEBHOOK_BODY_BYTES + 1) }),
        MAX_WEBHOOK_BODY_BYTES,
      ),
    ).toBe(true);
    expect(declaredBodyTooLarge(req(), MAX_WEBHOOK_BODY_BYTES)).toBe(false);
    expect(declaredBodyTooLarge(req({ 'content-length': 'junk' }), MAX_WEBHOOK_BODY_BYTES)).toBe(
      false,
    );
  });
});

describe('canonicalRedirect', () => {
  it('sends www to the apex over https, keeping path and query', () => {
    expect(canonicalRedirect(new URL('http://www.moneo.bond/pricing?x=1'))).toBe(
      'https://moneo.bond/pricing?x=1',
    );
  });

  it('leaves the apex and other hosts alone', () => {
    expect(canonicalRedirect(new URL('https://moneo.bond/'))).toBeNull();
    expect(canonicalRedirect(new URL('http://localhost:8787/'))).toBeNull();
  });
});
