import { describe, expect, it, vi } from 'vitest';

import { requestCustomerPortalUrl } from './billing/lemonSqueezy';
import { extractCustomerPortalUrl, fetchCustomerPortalUrl } from '../../cloudflare/workers/portal';

const PORTAL = 'https://moneo.lemonsqueezy.com/billing?token=abc';

function lemonPayload(url: unknown) {
  return { data: { id: '1', attributes: { urls: { customer_portal: url } } } };
}

describe('extractCustomerPortalUrl (Lemon Squeezy API shape)', () => {
  it('returns the pre-signed portal URL', () => {
    expect(extractCustomerPortalUrl(lemonPayload(PORTAL))).toBe(PORTAL);
  });

  it('rejects missing, non-https or malformed payloads (fail-closed)', () => {
    expect(extractCustomerPortalUrl(null)).toBeNull();
    expect(extractCustomerPortalUrl({})).toBeNull();
    expect(extractCustomerPortalUrl(lemonPayload(null))).toBeNull();
    expect(extractCustomerPortalUrl(lemonPayload('http://evil.test/x'))).toBeNull();
    expect(extractCustomerPortalUrl(lemonPayload('javascript:alert(1)'))).toBeNull();
    expect(extractCustomerPortalUrl(lemonPayload('not a url'))).toBeNull();
  });
});

describe('fetchCustomerPortalUrl (Worker → Lemon Squeezy API)', () => {
  it('prefers the subscription endpoint, falls back to customer', async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes('/subscriptions/')) {
        return { ok: true, json: async () => lemonPayload(PORTAL) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });
    const url = await fetchCustomerPortalUrl(
      { apiKey: 'key', customerId: 'c1', subscriptionId: 's1' },
      fetchImpl as unknown as typeof fetch,
    );
    expect(url).toBe(PORTAL);
    const firstCall = fetchImpl.mock.calls[0] as unknown[];
    expect(String(firstCall[0])).toContain('/subscriptions/s1');
  });

  it('uses the customer endpoint when there is no subscription id', async () => {
    const fetchImpl = vi.fn(async () => {
      return { ok: true, json: async () => lemonPayload(PORTAL) } as Response;
    });
    const url = await fetchCustomerPortalUrl(
      { apiKey: 'key', customerId: 'c1' },
      fetchImpl as unknown as typeof fetch,
    );
    expect(url).toBe(PORTAL);
    const firstCall = fetchImpl.mock.calls[0] as unknown[];
    expect(String(firstCall[0])).toContain('/customers/c1');
  });

  it('returns null when the API is unreachable or has no portal URL', async () => {
    const failing = vi.fn(async () => {
      return { ok: false, json: async () => ({}) } as Response;
    });
    expect(
      await fetchCustomerPortalUrl(
        { apiKey: 'key', customerId: 'c1' },
        failing as unknown as typeof fetch,
      ),
    ).toBeNull();
    expect(
      await fetchCustomerPortalUrl({ apiKey: '' }, failing as unknown as typeof fetch),
    ).toBeNull();
  });
});

describe('requestCustomerPortalUrl (browser → Worker)', () => {
  it('returns the Worker-issued portal URL', async () => {
    const fetchFn = vi.fn(async () => {
      return { ok: true, json: async () => ({ url: PORTAL }) } as Response;
    });
    const res = await requestCustomerPortalUrl(
      async () => 'supabase-jwt',
      fetchFn as unknown as typeof fetch,
    );
    expect(res).toEqual({ ok: true, url: PORTAL });
    const firstCall = fetchFn.mock.calls[0] as unknown[];
    const init = firstCall[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer supabase-jwt');
  });

  it('fails closed without a session, on HTTP errors or bad URLs', async () => {
    const okFetch = vi.fn(async () => {
      return { ok: true, json: async () => ({ url: PORTAL }) } as Response;
    });
    expect(
      await requestCustomerPortalUrl(async () => null, okFetch as unknown as typeof fetch),
    ).toEqual({
      ok: false,
      url: null,
    });

    const badFetch = vi.fn(async () => {
      return { ok: false, json: async () => ({}) } as Response;
    });
    expect(
      await requestCustomerPortalUrl(async () => 'jwt', badFetch as unknown as typeof fetch),
    ).toEqual({ ok: false, url: null });

    const evilFetch = vi.fn(async () => {
      return { ok: true, json: async () => ({ url: 'javascript:alert(1)' }) } as Response;
    });
    expect(
      await requestCustomerPortalUrl(async () => 'jwt', evilFetch as unknown as typeof fetch),
    ).toEqual({ ok: false, url: null });
  });
});
