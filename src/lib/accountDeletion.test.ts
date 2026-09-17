import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_DATA_TABLES,
  deleteAuthUser,
  deleteUserRows,
  handleAccountDelete,
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
    // Data tables in FK-safe order, all scoped to the TOKEN identity.
    const deletes = urls.slice(1, -1);
    expect(deletes).toEqual(
      [...ACCOUNT_DATA_TABLES].map((t) => `https://xyz.supabase.co/rest/v1/${t}?user_id=eq.user-1`),
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

  it('aborts before auth deletion when a table wipe fails', async () => {
    const { fn, calls } = stubFetch((url, _init) => {
      if (url.endsWith('/auth/v1/user')) return { status: 200, body: { id: 'user-1' } };
      if (url.includes('/rest/v1/focus_areas')) return { status: 500, body: {} };
      if (url.includes('/rest/v1/')) return { status: 200, body: [] };
      if (url.includes('/auth/v1/admin/users/')) return { status: 200, body: {} };
      return { status: 404, body: {} };
    });
    const res = await handleAccountDelete(deleteRequest('good-token'), ENV, fn);
    expect(res.status).toBe(500);
    expect(calls.some((c) => c.url.includes('/auth/v1/admin/users/'))).toBe(false);
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

describe('deleteUserRows / deleteAuthUser units', () => {
  it('deleteUserRows stops at the first failure', async () => {
    const { fn, calls } = stubFetch((url) => {
      if (url.includes('/rest/v1/focus_sessions')) return { status: 500, body: {} };
      return { status: 200, body: [] };
    });
    await expect(
      deleteUserRows(ENV.SUPABASE_URL!, ENV.SUPABASE_SERVICE_ROLE_KEY!, 'u', fn),
    ).resolves.toBe(false);
    expect(calls).toHaveLength(1);
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
