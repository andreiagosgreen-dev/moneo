import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_DATA_TABLES,
  deleteAuthUser,
  deleteUserRows,
  handleAccountDelete,
  isMissingTableResponse,
  verifyUserToken,
  type AccountEnv,
} from '../../cloudflare/workers/account';

const ENV: AccountEnv = {
  SUPABASE_URL: 'https://xyz.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'srv-key',
};

interface RecordedCall {
  url: string;
  method: string;
  auth?: string;
}

/** Fake fetch: canned per-URL responses + full call recording. */
function stubFetch(
  handler: (
    url: string,
    init: { method?: string; headers?: Record<string, string> },
  ) => {
    status: number;
    body: unknown;
  },
) {
  const calls: RecordedCall[] = [];
  const fn = (async (
    url: unknown,
    init?: {
      method?: string;
      headers?: Record<string, string>;
    },
  ) => {
    const u = String(url);
    const headers = init?.headers ?? {};
    calls.push({ url: u, method: init?.method ?? 'GET', auth: headers['Authorization'] });
    const r = handler(u, { method: init?.method, headers });
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  return { fn, calls };
}

/** Backend where the token belongs to user-1 and everything succeeds. */
function happyBackend() {
  return stubFetch((url, init) => {
    if (url.endsWith('/auth/v1/user')) {
      return init.headers?.['Authorization'] === 'Bearer good-token'
        ? { status: 200, body: { id: 'user-1', email: 'a@example.com' } }
        : { status: 401, body: { error: 'bad token' } };
    }
    if (url.includes('/auth/v1/admin/users/')) return { status: 200, body: {} };
    if (url.includes('/rest/v1/')) return { status: 200, body: [] };
    return { status: 404, body: {} };
  });
}

function deleteRequest(token: string | null, body?: unknown): Request {
  return new Request('https://moneo.bond/api/account/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('verifyUserToken', () => {
  it('resolves the user id from a valid JWT', async () => {
    const { fn } = happyBackend();
    await expect(
      verifyUserToken(ENV.SUPABASE_URL!, ENV.SUPABASE_SERVICE_ROLE_KEY!, 'good-token', fn),
    ).resolves.toBe('user-1');
  });

  it('rejects bad tokens and transport failures', async () => {
    const { fn } = happyBackend();
    await expect(
      verifyUserToken(ENV.SUPABASE_URL!, ENV.SUPABASE_SERVICE_ROLE_KEY!, 'bad-token', fn),
    ).resolves.toBeNull();
    const throwing = (async () => {
      throw new Error('down');
    }) as typeof fetch;
    await expect(
      verifyUserToken(ENV.SUPABASE_URL!, ENV.SUPABASE_SERVICE_ROLE_KEY!, 'good-token', throwing),
    ).resolves.toBeNull();
  });
});

describe('handleAccountDelete', () => {
  it('wipes data tables in order, then the auth user — identity from token only', async () => {
    const { fn, calls } = happyBackend();
    // Attacker tries to smuggle a victim id in the body: must be ignored.
    const res = await handleAccountDelete(
      deleteRequest('good-token', { user_id: 'victim' }),
      ENV,
      fn,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const urls = calls.map((c) => c.url);
    expect(urls[0]).toBe('https://xyz.supabase.co/auth/v1/user');
    // Data tables in FK-safe order, all scoped to the TOKEN identity, plus
    // the focus_buddy_pairs OR-filter cleanup (Faza 25 — no single user_id
    // column there), then the final auth-user delete.
    const deletes = urls.slice(1, -2);
    expect(deletes).toEqual(
      [...ACCOUNT_DATA_TABLES].map((t) => `https://xyz.supabase.co/rest/v1/${t}?user_id=eq.user-1`),
    );
    expect(urls[urls.length - 2]).toBe(
      'https://xyz.supabase.co/rest/v1/focus_buddy_pairs?or=(user_a.eq.user-1,user_b.eq.user-1)',
    );
    expect(urls[urls.length - 1]).toBe('https://xyz.supabase.co/auth/v1/admin/users/user-1');
    expect(urls.some((u) => u.includes('victim'))).toBe(false);
    // Service role used for backend calls, never the user token.
    expect(calls.slice(1).every((c) => c.auth === 'Bearer srv-key')).toBe(true);
  });

  it('rejects missing auth, wrong method and bad tokens without side effects', async () => {
    const { fn, calls } = happyBackend();
    expect((await handleAccountDelete(deleteRequest(null), ENV, fn)).status).toBe(401);
    const getReq = new Request('https://moneo.bond/api/account/delete', { method: 'GET' });
    expect((await handleAccountDelete(getReq, ENV, fn)).status).toBe(405);
    expect((await handleAccountDelete(deleteRequest('bad-token'), ENV, fn)).status).toBe(401);
    // Only the token-verification call happened; no deletes.
    expect(calls.every((c) => c.url.endsWith('/auth/v1/user'))).toBe(true);
  });

  it('fails closed without backend secrets', async () => {
    const { fn, calls } = happyBackend();
    const res = await handleAccountDelete(deleteRequest('good-token'), {}, fn);
    expect(res.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it.each(['PGRST205', '42P01'])(
    'skips an unmigrated optional table (%s) and still deletes everything else',
    async (code) => {
      const { fn, calls } = stubFetch((url) => {
        if (url.endsWith('/auth/v1/user')) return { status: 200, body: { id: 'user-1' } };
        if (url.includes('/rest/v1/google_calendar_connections')) {
          return {
            status: 404,
            body: {
              code,
              message: "Could not find the table 'public.google_calendar_connections'",
            },
          };
        }
        if (url.includes('/rest/v1/')) return { status: 200, body: [] };
        if (url.includes('/auth/v1/admin/users/')) return { status: 200, body: {} };
        return { status: 404, body: {} };
      });
      const res = await handleAccountDelete(deleteRequest('good-token'), ENV, fn);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      const urls = calls.map((c) => c.url);
      expect(urls.some((u) => u.includes('/rest/v1/profiles?'))).toBe(true);
      expect(urls.some((u) => u.includes('/rest/v1/focus_buddy_pairs?'))).toBe(true);
      expect(urls[urls.length - 1]).toBe('https://xyz.supabase.co/auth/v1/admin/users/user-1');
    },
  );

  it('keeps wiping after a failing table and deletes the auth user last', async () => {
    const { fn, calls } = stubFetch((url) => {
      if (url.endsWith('/auth/v1/user')) return { status: 200, body: { id: 'user-1' } };
      if (url.includes('/rest/v1/focus_areas')) return { status: 500, body: {} };
      if (url.includes('/rest/v1/')) return { status: 200, body: [] };
      if (url.includes('/auth/v1/admin/users/')) return { status: 200, body: {} };
      return { status: 404, body: {} };
    });
    const res = await handleAccountDelete(deleteRequest('good-token'), ENV, fn);
    // Auth delete cascades the rows the explicit wipe could not remove.
    expect(res.status).toBe(200);
    const urls = calls.map((c) => c.url);
    const areasIdx = urls.findIndex((u) => u.includes('/rest/v1/focus_areas'));
    const laterTables = urls.slice(areasIdx + 1).filter((u) => u.includes('/rest/v1/'));
    expect(laterTables.length).toBe(ACCOUNT_DATA_TABLES.length - 2 + 1);
    expect(urls[urls.length - 1]).toContain('/auth/v1/admin/users/user-1');
  });

  it('reports failure (never ok) when the auth user cannot be deleted', async () => {
    const { fn } = stubFetch((url) => {
      if (url.endsWith('/auth/v1/user')) return { status: 200, body: { id: 'user-1' } };
      if (url.includes('/rest/v1/profiles')) return { status: 500, body: {} };
      if (url.includes('/rest/v1/')) return { status: 200, body: [] };
      if (url.includes('/auth/v1/admin/users/')) return { status: 500, body: {} };
      return { status: 404, body: {} };
    });
    const res = await handleAccountDelete(deleteRequest('good-token'), ENV, fn);
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBeUndefined();
    expect(body).toMatchObject({ step: 'auth', failedTables: ['profiles'] });
  });

  it('does not skip a missing core table silently', async () => {
    const { fn, calls } = stubFetch((url) => {
      if (url.endsWith('/auth/v1/user')) return { status: 200, body: { id: 'user-1' } };
      if (url.includes('/rest/v1/profiles')) return { status: 404, body: { code: 'PGRST205' } };
      if (url.includes('/rest/v1/')) return { status: 200, body: [] };
      if (url.includes('/auth/v1/admin/users/')) return { status: 500, body: {} };
      return { status: 404, body: {} };
    });
    const res = await handleAccountDelete(deleteRequest('good-token'), ENV, fn);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ failedTables: ['profiles'] });
    expect(calls[calls.length - 1].url).toContain('/auth/v1/admin/users/');
  });

  it('treats an already-gone auth user as success (idempotent retries)', async () => {
    const { fn } = stubFetch((url) => {
      if (url.endsWith('/auth/v1/user')) return { status: 200, body: { id: 'user-1' } };
      if (url.includes('/auth/v1/admin/users/')) return { status: 404, body: {} };
      return { status: 200, body: [] };
    });
    const res = await handleAccountDelete(deleteRequest('good-token'), ENV, fn);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('handleAccountDelete — Lemon subscription cancellation', () => {
  const LEMON_ENV: AccountEnv = { ...ENV, LEMON_SQUEEZY_API_KEY: 'lemon-key' };

  function backendWithSubscription(status: string, lemonStatus = 200) {
    return stubFetch((url, init) => {
      if (url.endsWith('/auth/v1/user')) return { status: 200, body: { id: 'user-1' } };
      if (url.includes('/rest/v1/subscriptions?') && (init.method ?? 'GET') === 'GET') {
        return { status: 200, body: [{ lemon_subscription_id: 'sub-9', status }] };
      }
      if (url.startsWith('https://api.lemonsqueezy.com/')) return { status: lemonStatus, body: {} };
      if (url.includes('/auth/v1/admin/users/')) return { status: 200, body: {} };
      if (url.includes('/rest/v1/')) return { status: 200, body: [] };
      return { status: 404, body: {} };
    });
  }

  it('does not touch Lemon without the API key (default today)', async () => {
    const { fn, calls } = backendWithSubscription('active');
    const res = await handleAccountDelete(deleteRequest('good-token'), ENV, fn);
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.url.includes('lemonsqueezy'))).toBe(false);
  });

  it('cancels a live subscription before wiping data when the key is set', async () => {
    const { fn, calls } = backendWithSubscription('active');
    const res = await handleAccountDelete(deleteRequest('good-token'), LEMON_ENV, fn);
    expect(res.status).toBe(200);
    const cancelIdx = calls.findIndex(
      (c) => c.url === 'https://api.lemonsqueezy.com/v1/subscriptions/sub-9',
    );
    expect(cancelIdx).toBeGreaterThan(0);
    expect(calls[cancelIdx].method).toBe('DELETE');
    expect(calls[cancelIdx].auth).toBe('Bearer lemon-key');
    const firstWipe = calls.findIndex((c) => c.method === 'DELETE' && c.url.includes('/rest/v1/'));
    expect(cancelIdx).toBeLessThan(firstWipe);
  });

  it('skips already-cancelled subscriptions', async () => {
    const { fn, calls } = backendWithSubscription('cancelled');
    const res = await handleAccountDelete(deleteRequest('good-token'), LEMON_ENV, fn);
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.url.includes('lemonsqueezy'))).toBe(false);
  });

  it('aborts (nothing deleted) when Lemon refuses the cancel', async () => {
    const { fn, calls } = backendWithSubscription('active', 500);
    const res = await handleAccountDelete(deleteRequest('good-token'), LEMON_ENV, fn);
    expect(res.status).toBe(502);
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('supabase.co'))).toBe(false);
  });

  it('treats a subscription Lemon no longer knows as done', async () => {
    const { fn } = backendWithSubscription('active', 404);
    const res = await handleAccountDelete(deleteRequest('good-token'), LEMON_ENV, fn);
    expect(res.status).toBe(200);
  });
});

describe('deleteUserRows / deleteAuthUser units', () => {
  it('deleteUserRows continues past failures and reports them', async () => {
    const { fn, calls } = stubFetch((url) => {
      if (url.includes('/rest/v1/focus_sessions')) return { status: 500, body: {} };
      if (url.includes('/rest/v1/google_calendar_connections')) {
        return { status: 404, body: { code: '42P01' } };
      }
      return { status: 200, body: [] };
    });
    await expect(
      deleteUserRows(ENV.SUPABASE_URL!, ENV.SUPABASE_SERVICE_ROLE_KEY!, 'u', fn),
    ).resolves.toEqual({ failed: ['focus_sessions'], skipped: ['google_calendar_connections'] });
    expect(calls).toHaveLength(ACCOUNT_DATA_TABLES.length + 1);
  });

  it('deleteUserRows maps a per-table transport error to that table only', async () => {
    let n = 0;
    const flaky = (async () => {
      n += 1;
      if (n === 1) throw new Error('down');
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    await expect(
      deleteUserRows(ENV.SUPABASE_URL!, ENV.SUPABASE_SERVICE_ROLE_KEY!, 'u', flaky),
    ).resolves.toEqual({ failed: [ACCOUNT_DATA_TABLES[0]], skipped: [] });
    expect(n).toBe(ACCOUNT_DATA_TABLES.length + 1);
  });

  it('isMissingTableResponse only matches relation-does-not-exist codes', async () => {
    const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    await expect(isMissingTableResponse(res(404, { code: 'PGRST205' }))).resolves.toBe(true);
    await expect(isMissingTableResponse(res(404, { code: '42P01' }))).resolves.toBe(true);
    await expect(isMissingTableResponse(res(500, { code: '23503' }))).resolves.toBe(false);
    await expect(isMissingTableResponse(new Response('oops', { status: 502 }))).resolves.toBe(
      false,
    );
    await expect(isMissingTableResponse(res(200, { code: '42P01' }))).resolves.toBe(false);
  });

  it('deleteAuthUser maps transport errors to false', async () => {
    const throwing = (async () => {
      throw new Error('down');
    }) as typeof fetch;
    await expect(
      deleteAuthUser(ENV.SUPABASE_URL!, ENV.SUPABASE_SERVICE_ROLE_KEY!, 'u', throwing),
    ).resolves.toBe(false);
  });
});
