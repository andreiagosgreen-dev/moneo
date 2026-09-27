import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_DATA_TABLES,
  OPTIONAL_ACCOUNT_TABLES,
  deleteUserRows,
} from '../../../cloudflare/workers/account';
import {
  MAX_CLOCK_SKEW_MS,
  MAX_RECORDS_PER_REQUEST,
  handleSyncRecords,
  validateRecords,
  type ProSyncEnv,
} from '../../../cloudflare/workers/proSync';

const ENV: ProSyncEnv = {
  SUPABASE_URL: 'https://xyz.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'srv-key',
};
const NOW = 1_800_000_000_000;

interface Call {
  url: string;
  method: string;
  body: string | null;
}

function stubFetch(handler: (url: string, method: string) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const fn = (async (url: unknown, init?: { method?: string; body?: string }) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    calls.push({ url: u, method, body: init?.body ?? null });
    const r = handler(u, method);
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  return { fn, calls };
}

function backend(
  opts: { status?: string; email?: string; rpc?: { status: number; body: unknown } } = {},
) {
  return stubFetch((url) => {
    if (url.endsWith('/auth/v1/user')) {
      return { status: 200, body: { id: 'user-1', email: opts.email ?? 'buyer@example.com' } };
    }
    if (url.includes('/rest/v1/subscriptions')) {
      return { status: 200, body: [{ status: opts.status ?? 'active', current_period_end: null }] };
    }
    if (url.includes('/rest/v1/rpc/upsert_user_records'))
      return opts.rpc ?? { status: 200, body: 1 };
    return { status: 404, body: {} };
  });
}

function syncRequest(body: unknown, token: string | null = 'tok', method = 'POST'): Request {
  return new Request('https://moneo.bond/api/sync/records', {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

const TASK = {
  collection: 'tasks',
  record_id: 't1',
  data: { id: 't1' },
  deleted: false,
  updated_at: NOW - 1,
};

describe('validateRecords', () => {
  it('accepts a well-formed batch and tombstones', () => {
    const out = validateRecords(
      [TASK, { collection: 'journal', record_id: '2026-09-27', deleted: true, updated_at: 5 }],
      NOW,
    );
    expect(out).toEqual([
      TASK,
      { collection: 'journal', record_id: '2026-09-27', data: null, deleted: true, updated_at: 5 },
    ]);
  });

  it.each([
    ['empty batch', []],
    ['not an array', { records: [] }],
    ['unknown collection', [{ ...TASK, collection: 'focus_sessions' }]],
    ['empty id', [{ ...TASK, record_id: '' }]],
    ['long id', [{ ...TASK, record_id: 'x'.repeat(201) }]],
    ['negative time', [{ ...TASK, updated_at: -1 }]],
    ['string time', [{ ...TASK, updated_at: '1' }]],
    ['live row without data', [{ ...TASK, data: null }]],
    ['too big', [{ ...TASK, data: 'x'.repeat(200_001) }]],
    [
      'too many',
      Array.from({ length: MAX_RECORDS_PER_REQUEST + 1 }, (_, i) => ({
        ...TASK,
        record_id: `t${i}`,
      })),
    ],
  ])('rejects the whole batch: %s', (_label, input) => {
    expect(validateRecords(input, NOW)).toBeNull();
  });

  it('keeps the newest duplicate and clamps future timestamps', () => {
    const out = validateRecords(
      [
        { ...TASK, data: { v: 'old' }, updated_at: 10 },
        { ...TASK, data: { v: 'new' }, updated_at: 20 },
        { ...TASK, record_id: 'future', updated_at: NOW + 60 * 60_000 },
      ],
      NOW,
    );
    expect(out).toHaveLength(2);
    expect(out?.find((r) => r.record_id === 't1')?.data).toEqual({ v: 'new' });
    expect(out?.find((r) => r.record_id === 'future')?.updated_at).toBe(NOW + MAX_CLOCK_SKEW_MS);
  });
});

describe('handleSyncRecords', () => {
  it('writes a Pro user’s batch through the service-role RPC, scoped to the token identity', async () => {
    const { fn, calls } = backend();
    const res = await handleSyncRecords(
      syncRequest({ records: [TASK], user_id: 'victim' }),
      ENV,
      fn,
      () => NOW,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, received: 1, written: 1 });
    const rpc = calls.find((c) => c.url.endsWith('/rest/v1/rpc/upsert_user_records'));
    expect(JSON.parse(rpc!.body!)).toEqual({ p_user_id: 'user-1', p_records: [TASK] });
    expect(calls.some((c) => c.url.includes('victim') || c.body?.includes('victim'))).toBe(false);
  });

  it('refuses Free and lapsed accounts server-side', async () => {
    for (const status of ['free', 'expired', 'unpaid']) {
      const { fn, calls } = backend({ status });
      const res = await handleSyncRecords(syncRequest({ records: [TASK] }), ENV, fn, () => NOW);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'not_pro' });
      expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
    }
  });

  it('allows complimentary Pro accounts (email allowlist)', async () => {
    const { fn } = backend({ status: 'free', email: 'comp@example.com' });
    const res = await handleSyncRecords(
      syncRequest({ records: [TASK] }),
      { ...ENV, PRO_COMPLIMENTARY_EMAILS: 'comp@example.com' },
      fn,
      () => NOW,
    );
    expect(res.status).toBe(200);
  });

  it('rejects missing auth, wrong method, bad JSON and invalid records', async () => {
    const { fn } = backend();
    expect((await handleSyncRecords(syncRequest({ records: [TASK] }, null), ENV, fn)).status).toBe(
      401,
    );
    expect((await handleSyncRecords(syncRequest(null, 'tok', 'GET'), ENV, fn)).status).toBe(405);
    const bad = new Request('https://moneo.bond/api/sync/records', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
      body: '{not json',
    });
    expect((await handleSyncRecords(bad, ENV, fn)).status).toBe(400);
    expect(
      (await handleSyncRecords(syncRequest({ records: [{ ...TASK, collection: 'x' }] }), ENV, fn))
        .status,
    ).toBe(400);
  });

  it('is 503 when not configured and when migration 0011 is missing', async () => {
    const { fn } = backend();
    expect((await handleSyncRecords(syncRequest({ records: [TASK] }), {}, fn)).status).toBe(503);

    const missing = backend({ rpc: { status: 404, body: { code: 'PGRST202' } } });
    const res = await handleSyncRecords(
      syncRequest({ records: [TASK] }),
      ENV,
      missing.fn,
      () => NOW,
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'not_migrated' });

    const broken = backend({ rpc: { status: 500, body: { code: 'XX000' } } });
    expect(
      (await handleSyncRecords(syncRequest({ records: [TASK] }), ENV, broken.fn, () => NOW)).status,
    ).toBe(502);
  });

  it('refuses oversized payloads before reading them', async () => {
    const { fn, calls } = backend();
    const req = new Request('https://moneo.bond/api/sync/records', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Length': String(5_000_000) },
      body: '{}',
    });
    expect((await handleSyncRecords(req, ENV, fn)).status).toBe(413);
    expect(calls).toHaveLength(0);
  });
});

describe('account deletion covers user_records', () => {
  it('lists user_records as account data that may be missing before migration 0011', () => {
    expect(ACCOUNT_DATA_TABLES).toContain('user_records');
    expect(OPTIONAL_ACCOUNT_TABLES.has('user_records')).toBe(true);
  });

  it('skips user_records when the table does not exist yet', async () => {
    const { fn } = stubFetch((url) =>
      url.includes('/rest/v1/user_records')
        ? { status: 404, body: { code: 'PGRST205' } }
        : { status: 200, body: [] },
    );
    const res = await deleteUserRows(
      ENV.SUPABASE_URL!,
      ENV.SUPABASE_SERVICE_ROLE_KEY!,
      'user-1',
      fn,
    );
    expect(res).toEqual({ failed: [], skipped: ['user_records'] });
  });
});
