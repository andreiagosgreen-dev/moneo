import { describe, expect, it, vi } from 'vitest';
import {
  CODE_VALID_DAYS,
  claimKey,
  computeServerXp,
  evaluateDiscount,
  generateDiscountCode,
  handleRankDiscount,
  percentFor,
  type DiscountEnv,
  type DiscountKV,
} from '../../../cloudflare/workers/discount';
import { xpAtLevel } from '../xpCore';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 29, 12);
const USER = 'user-1';

function memoryKv(
  initial: Record<string, string> = {},
): DiscountKV & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    put: async (k, v) => {
      data.set(k, v);
    },
    delete: async (k) => {
      data.delete(k);
    },
  };
}

/** `days` consecutive UTC days of focus ending yesterday, `min` minutes each. */
function sessionRows(days: number, min: number) {
  return Array.from({ length: days }, (_, i) => ({
    completed_at: new Date(NOW - (i + 1) * DAY).toISOString(),
    duration_min: min,
  }));
}

interface MockOpts {
  createdDaysAgo?: number;
  sessions?: Array<{ completed_at: string; duration_min: number }>;
  records?: unknown[];
  subscription?: { plan_id: string; status: string; current_period_end: string | null } | null;
  lemonOk?: boolean;
}

function mockFetch(opts: MockOpts = {}) {
  const created = new Date(NOW - (opts.createdDaysAgo ?? 200) * DAY).toISOString();
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const ok = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    if (url.endsWith('/auth/v1/user')) {
      const auth = new Headers(init?.headers).get('Authorization');
      if (auth !== 'Bearer good-token') return ok({ msg: 'bad jwt' }, 401);
      return ok({ id: USER, email: 'me@example.com', created_at: created });
    }
    if (url.includes('/rest/v1/subscriptions')) {
      return ok(opts.subscription ? [opts.subscription] : []);
    }
    if (url.includes('/rest/v1/focus_sessions')) return ok(opts.sessions ?? []);
    if (url.includes('/rest/v1/user_records')) return ok(opts.records ?? []);
    if (url === 'https://api.lemonsqueezy.com/v1/discounts') {
      return opts.lemonOk === false
        ? ok({ errors: [{ detail: 'nope' }] }, 422)
        : ok({ data: { type: 'discounts', id: '9001' } }, 201);
    }
    return ok({ error: `unexpected ${url}` }, 500);
  });
}

function env(kv: DiscountKV, overrides: Partial<DiscountEnv> = {}): DiscountEnv {
  return {
    SUPABASE_URL: 'https://sb.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    LEMON_SQUEEZY_API_KEY: 'lemon-key',
    LEMON_STORE_ID: '478882',
    LEMON_MONTHLY_VARIANT_ID: '2156059',
    KV_CACHE: kv,
    ...overrides,
  };
}

function req(method: 'GET' | 'POST', token: string | null = 'good-token', body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('https://moneo.bond/api/billing/discount', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const deps = (fetchImpl: ReturnType<typeof mockFetch>) => ({
  fetchImpl: fetchImpl as unknown as typeof fetch,
  now: () => NOW,
  newCode: () => 'MONEOTESTCODE1',
});

function lemonCalls(f: ReturnType<typeof mockFetch>) {
  return f.mock.calls.filter(([u]) => String(u).startsWith('https://api.lemonsqueezy.com'));
}

describe('percentFor', () => {
  it('maps ranks to the first-month percentage', () => {
    expect(percentFor('beginner')).toBe(0);
    expect(percentFor('apprentice')).toBe(20);
    expect(percentFor('practitioner')).toBe(30);
    expect(percentFor('expert')).toBe(40);
    expect(percentFor('master')).toBe(50);
  });
});

describe('evaluateDiscount', () => {
  const base = { now: NOW, accountCreatedAt: NOW - 30 * DAY, pro: 'none' as const, claim: null };

  it('derives the rank from XP and the percent from the rank', () => {
    expect(evaluateDiscount({ ...base, xp: xpAtLevel(4) })).toMatchObject({
      eligible: true,
      rank: 'apprentice',
      percent: 20,
    });
    expect(evaluateDiscount({ ...base, xp: xpAtLevel(9) }).percent).toBe(30);
    expect(evaluateDiscount({ ...base, xp: xpAtLevel(15) }).percent).toBe(40);
    expect(evaluateDiscount({ ...base, xp: xpAtLevel(22) }).percent).toBe(50);
  });

  it('explains how a Beginner becomes eligible', () => {
    expect(evaluateDiscount({ ...base, xp: xpAtLevel(4) - 1 })).toMatchObject({
      eligible: false,
      reason: 'rank_too_low',
      targetRank: 'apprentice',
      targetLevel: 4,
      targetPercent: 20,
    });
  });

  it('requires an account at least 7 days old', () => {
    const s = evaluateDiscount({ ...base, accountCreatedAt: NOW - 3 * DAY, xp: xpAtLevel(9) });
    expect(s).toMatchObject({ eligible: false, reason: 'too_new' });
    expect(s.eligibleFrom).toBe(new Date(NOW + 4 * DAY).toISOString());
    expect(evaluateDiscount({ ...base, accountCreatedAt: undefined, xp: 99999 }).reason).toBe(
      'too_new',
    );
  });

  it('shows no offer to accounts that already have Pro', () => {
    expect(evaluateDiscount({ ...base, pro: 'pro', xp: 99999 })).toMatchObject({
      eligible: false,
      reason: 'already_pro',
    });
  });

  it('returns a live claim and refuses a second code after it expired', () => {
    const claim = {
      code: 'MONEOX',
      percent: 20,
      expiresAt: NOW + DAY,
      discountId: '1',
      createdAt: NOW - DAY,
    };
    expect(evaluateDiscount({ ...base, xp: 0, claim })).toMatchObject({
      eligible: true,
      discountCode: 'MONEOX',
      percent: 20,
    });
    const expired = { ...claim, expiresAt: NOW - 1 };
    expect(evaluateDiscount({ ...base, xp: 99999, claim: expired })).toMatchObject({
      eligible: false,
      reason: 'claimed',
    });
  });
});

describe('computeServerXp', () => {
  it('only counts activity between account creation and now', () => {
    const from = NOW - 2 * DAY;
    const xp = computeServerXp(
      {
        sessions: [
          { at: NOW - 10 * DAY, min: 200 },
          { at: NOW - DAY, min: 100 },
          { at: NOW + DAY, min: 100 },
        ],
        tasks: [
          { status: 'completed', completedAt: NOW - DAY },
          { status: 'completed', completedAt: NOW - 30 * DAY },
          { status: 'pending', completedAt: NOW - DAY },
        ],
        habitLog: { h1: ['2026-9-28', '2026-1-1', 'junk'] },
      },
      from,
      NOW,
    );
    expect(xp).toBe(100 + 10 + 5);
  });

  it('keeps the daily focus cap', () => {
    const xp = computeServerXp(
      { sessions: [{ at: NOW - DAY, min: 1000 }], tasks: [], habitLog: {} },
      NOW - 5 * DAY,
      NOW,
    );
    expect(xp).toBe(240);
  });
});

describe('generateDiscountCode', () => {
  it('produces uppercase alphanumeric single-use codes', () => {
    const code = generateDiscountCode();
    expect(code).toMatch(/^MONEO[A-Z0-9]{10}$/);
    expect(generateDiscountCode()).not.toBe(code);
  });
});

describe('handleRankDiscount', () => {
  it('answers 503 not_configured without the Lemon API key and calls nothing', async () => {
    const f = mockFetch();
    const res = await handleRankDiscount(
      req('POST'),
      env(memoryKv(), { LEMON_SQUEEZY_API_KEY: undefined }),
      deps(f),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'not_configured' });
    expect(f).not.toHaveBeenCalled();
  });

  it('answers 503 not_configured without KV or store id', async () => {
    const f = mockFetch();
    const noKv = await handleRankDiscount(
      req('GET'),
      env(memoryKv(), { KV_CACHE: undefined }),
      deps(f),
    );
    const noStore = await handleRankDiscount(
      req('GET'),
      env(memoryKv(), { LEMON_STORE_ID: '' }),
      deps(f),
    );
    expect(noKv.status).toBe(503);
    expect(noStore.status).toBe(503);
  });

  it('requires a valid session', async () => {
    const f = mockFetch();
    expect((await handleRankDiscount(req('GET', null), env(memoryKv()), deps(f))).status).toBe(401);
    expect((await handleRankDiscount(req('GET', 'forged'), env(memoryKv()), deps(f))).status).toBe(
      401,
    );
  });

  it('GET reports the server-computed offer and never calls Lemon', async () => {
    const f = mockFetch({ sessions: sessionRows(26, 240) });
    const res = await handleRankDiscount(req('GET'), env(memoryKv()), deps(f));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      eligible: true,
      rank: 'practitioner',
      percent: 30,
    });
    expect(lemonCalls(f)).toHaveLength(0);
  });

  it('POST creates a single-use, 14-day, first-month code and stores the claim', async () => {
    const kv = memoryKv();
    const f = mockFetch({ sessions: sessionRows(26, 240) });
    const res = await handleRankDiscount(req('POST'), env(kv), deps(f));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      discountCode: 'MONEOTESTCODE1',
      percent: 30,
    });
    expect(body.expiresAt).toBe(new Date(NOW + CODE_VALID_DAYS * DAY).toISOString());

    const calls = lemonCalls(f);
    expect(calls).toHaveLength(1);
    const [, init] = calls[0];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer lemon-key');
    const sent = JSON.parse(String(init?.body));
    expect(sent.data.attributes).toMatchObject({
      code: 'MONEOTESTCODE1',
      amount: 30,
      amount_type: 'percent',
      duration: 'once',
      is_limited_redemptions: true,
      max_redemptions: 1,
      is_limited_to_products: true,
      expires_at: new Date(NOW + 14 * DAY).toISOString(),
    });
    expect(sent.data.relationships.store.data).toEqual({ type: 'stores', id: '478882' });
    expect(sent.data.relationships.variants.data).toEqual([{ type: 'variants', id: '2156059' }]);

    const stored = JSON.parse(kv.data.get(claimKey(USER)) ?? '{}');
    expect(stored).toMatchObject({ code: 'MONEOTESTCODE1', discountId: '9001', percent: 30 });
    expect(kv.data.has(`discount-lock:${USER}`)).toBe(false);
  });

  it('gives one code per account: a second POST returns the same code', async () => {
    const kv = memoryKv();
    const f = mockFetch({ sessions: sessionRows(26, 240) });
    await handleRankDiscount(req('POST'), env(kv), deps(f));
    const again = await handleRankDiscount(req('POST'), env(kv), {
      ...deps(f),
      newCode: () => 'MONEOOTHER0000',
    });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ discountCode: 'MONEOTESTCODE1' });
    expect(lemonCalls(f)).toHaveLength(1);
  });

  it('does not mint a new code once the claimed one expired', async () => {
    const kv = memoryKv({
      [claimKey(USER)]: JSON.stringify({
        code: 'MONEOOLD',
        percent: 10,
        expiresAt: NOW - 1,
        discountId: '1',
        createdAt: NOW - 20 * DAY,
      }),
    });
    const f = mockFetch({ sessions: sessionRows(26, 240) });
    const res = await handleRankDiscount(req('POST'), env(kv), deps(f));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'not_eligible', reason: 'claimed' });
    expect(lemonCalls(f)).toHaveLength(0);
  });

  it('a Lemon failure stores no claim and releases the lock', async () => {
    const kv = memoryKv();
    const f = mockFetch({ sessions: sessionRows(26, 240), lemonOk: false });
    const res = await handleRankDiscount(req('POST'), env(kv), deps(f));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: 'lemon_error' });
    expect(kv.data.size).toBe(0);
  });

  it('ignores a client-sent level and refuses a Beginner', async () => {
    const f = mockFetch({ sessions: sessionRows(1, 30) });
    const res = await handleRankDiscount(
      req('POST', 'good-token', { level: 99, rank: 'master' }),
      env(memoryKv()),
      deps(f),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ rank: 'beginner', reason: 'rank_too_low' });
    expect(lemonCalls(f)).toHaveLength(0);
  });

  it('does not credit focus uploaded with dates before the account existed', async () => {
    const f = mockFetch({ createdDaysAgo: 8, sessions: sessionRows(40, 240) });
    const res = await handleRankDiscount(req('GET'), env(memoryKv()), deps(f));
    const body = (await res.json()) as { xp: number; rank: string };
    expect(body.xp).toBe(8 * 240);
    expect(body.rank).toBe('apprentice');
  });

  it('refuses accounts younger than 7 days', async () => {
    const f = mockFetch({ createdDaysAgo: 2, sessions: sessionRows(2, 240) });
    const res = await handleRankDiscount(req('POST'), env(memoryKv()), deps(f));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ reason: 'too_new' });
  });

  it('existing Pro subscribers (monthly or yearly) get no offer and no code', async () => {
    for (const plan_id of ['pro-monthly', 'pro-yearly']) {
      const kv = memoryKv();
      const f = mockFetch({
        sessions: sessionRows(26, 240),
        subscription: { plan_id, status: 'active', current_period_end: null },
      });
      const res = await handleRankDiscount(req('POST'), env(kv), deps(f));
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ eligible: false, reason: 'already_pro' });
      expect(lemonCalls(f)).toHaveLength(0);
      expect(kv.data.size).toBe(0);
    }
  });

  it('a lapsed subscription counts as no Pro', async () => {
    const f = mockFetch({
      sessions: sessionRows(26, 240),
      subscription: { plan_id: 'pro-monthly', status: 'expired', current_period_end: null },
    });
    const res = await handleRankDiscount(req('GET'), env(memoryKv()), deps(f));
    expect(await res.json()).toMatchObject({ eligible: true, percent: 30 });
  });

  it('counts synced tasks and habit check-ins from user_records', async () => {
    const f = mockFetch({
      records: [
        {
          collection: 'tasks',
          record_id: 't1',
          data: { status: 'completed', completedAt: NOW - DAY, milestone: true },
        },
        { collection: 'habit_log', record_id: 'h1', data: ['2026-9-27', '2026-9-28'] },
      ],
    });
    const res = await handleRankDiscount(req('GET'), env(memoryKv()), deps(f));
    expect(await res.json()).toMatchObject({ xp: 25 + 10 });
  });
});
