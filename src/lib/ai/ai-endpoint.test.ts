import { describe, expect, it } from 'vitest';
import { handleAIPlan, validateAIRequest } from '../../../cloudflare/workers/ai';
import type { FetchImpl } from '../../../cloudflare/workers/account';

function req(method: string, body: string, headers: Record<string, string> = {}): Request {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method,
    headers: { get: (k: string) => lower.get(k.toLowerCase()) ?? null },
    text: async () => body,
  } as unknown as Request;
}

/** Auth resolves `u-1`; the subscriptions lookup returns `subRows`. */
function fetchFor(subRows: unknown[], email = 'u1@example.com'): FetchImpl {
  return (async (url: string) => ({
    ok: true,
    json: async () =>
      String(url).includes('/rest/v1/subscriptions') ? subRows : { id: 'u-1', email },
  })) as unknown as FetchImpl;
}

const okFetch = fetchFor([{ status: 'active', current_period_end: null }]);

const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
const AUTH = { Authorization: 'Bearer good-token', 'cf-connecting-ip': 'ai-t' };
const BODY = JSON.stringify({ goal: 'Learn React', horizonMonths: 6, hoursPerWeek: 5 });

async function statusOf(res: Response): Promise<{ status: number; json: unknown }> {
  return { status: res.status, json: await res.json() };
}

describe('validateAIRequest', () => {
  it('accepts a well-formed minimal context', () => {
    expect(
      validateAIRequest({ goal: 'Learn React', horizonMonths: 6, hoursPerWeek: 5 }),
    ).toMatchObject({ ok: true, goal: 'Learn React' });
  });

  it('rejects junk shapes and out-of-range numbers', () => {
    expect(validateAIRequest(null).ok).toBe(false);
    expect(validateAIRequest({}).ok).toBe(false);
    expect(validateAIRequest({ goal: '', horizonMonths: 6, hoursPerWeek: 5 }).ok).toBe(false);
    expect(validateAIRequest({ goal: 'x'.repeat(501), horizonMonths: 6, hoursPerWeek: 5 }).ok).toBe(
      false,
    );
    expect(validateAIRequest({ goal: 'x', horizonMonths: 0, hoursPerWeek: 5 }).ok).toBe(false);
    expect(validateAIRequest({ goal: 'x', horizonMonths: 6, hoursPerWeek: 99 }).ok).toBe(false);
  });
});

describe('handleAIPlan', () => {
  it('rejects non-POST', async () => {
    const { status } = await statusOf(await handleAIPlan(req('GET', '', AUTH), ENV, okFetch));
    expect(status).toBe(405);
  });

  it('fails closed without backend config', async () => {
    const { status } = await statusOf(await handleAIPlan(req('POST', BODY, AUTH), {}, okFetch));
    expect(status).toBe(503);
  });

  it('requires a verifiable JWT identity', async () => {
    const noAuth = await statusOf(
      await handleAIPlan(req('POST', BODY, { 'cf-connecting-ip': 'ai-t2' }), ENV, okFetch),
    );
    expect(noAuth.status).toBe(401);
    const badFetch = (async () => ({ ok: false })) as unknown as FetchImpl;
    const bad = await statusOf(
      await handleAIPlan(
        req('POST', BODY, { ...AUTH, 'cf-connecting-ip': 'ai-t3' }),
        ENV,
        badFetch,
      ),
    );
    expect(bad.status).toBe(401);
  });

  it('gates the planner on server-side Pro (Free → 403 not_pro, before the model)', async () => {
    const calls: string[] = [];
    const freeFetch = (async (url: string) => {
      calls.push(String(url));
      return {
        ok: true,
        json: async () =>
          String(url).includes('/rest/v1/subscriptions') ? [] : { id: 'u-1', email: 'f@x.com' },
      };
    }) as unknown as FetchImpl;
    const free = await statusOf(
      await handleAIPlan(
        req('POST', BODY, { ...AUTH, 'cf-connecting-ip': 'ai-pro1' }),
        { ...ENV, AI_API_KEY: 'k' },
        freeFetch,
      ),
    );
    expect(free.status).toBe(403);
    expect(free.json).toMatchObject({ code: 'not_pro' });
    expect(calls.some((u) => u.includes('chat/completions'))).toBe(false);

    const lapsed = await statusOf(
      await handleAIPlan(
        req('POST', BODY, { ...AUTH, 'cf-connecting-ip': 'ai-pro2' }),
        ENV,
        fetchFor([{ status: 'cancelled', current_period_end: '2000-01-01T00:00:00Z' }]),
      ),
    );
    expect(lapsed.status).toBe(403);

    const pro = await statusOf(
      await handleAIPlan(
        req('POST', BODY, { ...AUTH, 'cf-connecting-ip': 'ai-pro3' }),
        ENV,
        okFetch,
      ),
    );
    expect(pro.status).toBe(501);
  });

  it('lets complimentary Pro emails through without a paid row', async () => {
    const { status } = await statusOf(
      await handleAIPlan(
        req('POST', BODY, { ...AUTH, 'cf-connecting-ip': 'ai-pro4' }),
        { ...ENV, PRO_COMPLIMENTARY_EMAILS: 'comp@example.com' },
        fetchFor([], 'Comp@Example.com'),
      ),
    );
    expect(status).toBe(501);
  });

  it('rejects oversized and malformed bodies', async () => {
    const big = await statusOf(
      await handleAIPlan(
        req('POST', 'x', { ...AUTH, 'cf-connecting-ip': 'ai-t4', 'content-length': '99999999' }),
        ENV,
        okFetch,
      ),
    );
    expect(big.status).toBe(413);
    const malformed = await statusOf(
      await handleAIPlan(
        req('POST', 'not-json', { ...AUTH, 'cf-connecting-ip': 'ai-t5' }),
        ENV,
        okFetch,
      ),
    );
    expect(malformed.status).toBe(400);
    const badShape = await statusOf(
      await handleAIPlan(req('POST', '{}', { ...AUTH, 'cf-connecting-ip': 'ai-t6' }), ENV, okFetch),
    );
    expect(badShape.status).toBe(400);
  });

  it('returns 501 without a model key (local planner stays usable)', async () => {
    const { status, json } = await statusOf(
      await handleAIPlan(req('POST', BODY, { ...AUTH, 'cf-connecting-ip': 'ai-t7' }), ENV, okFetch),
    );
    expect(status).toBe(501);
    expect(json).toMatchObject({ configured: false });
  });

  it('rate-limits per IP (11th rapid call is 429)', async () => {
    const ip = { ...AUTH, 'cf-connecting-ip': 'ai-burst' };
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await handleAIPlan(req('POST', BODY, ip), ENV, okFetch)).status);
    }
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(501));
    expect(statuses[10]).toBe(429);
  });

  it('sends security headers on every response', async () => {
    const res = await handleAIPlan(
      req('POST', BODY, { ...AUTH, 'cf-connecting-ip': 'ai-t8' }),
      ENV,
      okFetch,
    );
    expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
