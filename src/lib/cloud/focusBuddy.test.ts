import { describe, expect, it } from 'vitest';
import {
  handleBuddyInvite,
  handleBuddyJoin,
  handleBuddyStatus,
  handleBuddyUnpair,
  type FocusBuddyEnv,
} from '../../../cloudflare/workers/focusBuddy';

const ENV: FocusBuddyEnv = {
  SUPABASE_URL: 'https://xyz.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'srv-key',
};

interface Call {
  url: string;
  method: string;
}

/** Fake fetch: canned per-URL responses + call recording, mirrors accountDeletion.test.ts. */
function stubFetch(handler: (url: string, method: string) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const fn = (async (url: unknown, init?: { method?: string }) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    calls.push({ url: u, method });
    const r = handler(u, method);
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  return { fn, calls };
}

function authedRequest(path: string, token: string | null, body?: unknown): Request {
  return new Request(`https://moneo.bond${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** user-1, Pro, no existing pairing — the happy path for invite/join. */
function proBackend(
  extra?: (url: string, method: string) => { status: number; body: unknown } | null,
) {
  return stubFetch((url, method) => {
    const custom = extra?.(url, method);
    if (custom) return custom;
    if (url.endsWith('/auth/v1/user')) return { status: 200, body: { id: 'user-1' } };
    if (url.includes('/rest/v1/subscriptions'))
      return { status: 200, body: [{ status: 'active' }] };
    if (url.includes('/rest/v1/focus_buddy_pairs') && method === 'GET') {
      return { status: 200, body: [] };
    }
    if (url.includes('/rest/v1/focus_buddy_pairs')) return { status: 200, body: [] };
    return { status: 404, body: {} };
  });
}

describe('handleBuddyInvite', () => {
  it('rejects missing auth and non-Pro users', async () => {
    const { fn } = proBackend();
    expect(
      (await handleBuddyInvite(authedRequest('/api/buddy/invite', null), ENV, fn)).status,
    ).toBe(401);

    const { fn: freeFn } = proBackend((url) =>
      url.includes('subscriptions') ? { status: 200, body: [{ status: 'free' }] } : null,
    );
    expect(
      (await handleBuddyInvite(authedRequest('/api/buddy/invite', 'tok'), ENV, freeFn)).status,
    ).toBe(403);
  });

  it('allows invite for complimentary Free users (email allowlist)', async () => {
    const { fn } = stubFetch((url, method) => {
      if (url.endsWith('/auth/v1/user'))
        return { status: 200, body: { id: 'user-1', email: 'comp@example.com' } };
      if (url.includes('/rest/v1/subscriptions'))
        return { status: 200, body: [{ status: 'free' }] };
      if (url.includes('/rest/v1/focus_buddy_pairs') && method === 'GET') {
        return { status: 200, body: [] };
      }
      if (url.includes('/rest/v1/focus_buddy_pairs')) return { status: 200, body: [] };
      return { status: 404, body: {} };
    });
    const env: FocusBuddyEnv = {
      ...ENV,
      PRO_COMPLIMENTARY_EMAILS: 'comp@example.com',
    };
    const res = await handleBuddyInvite(authedRequest('/api/buddy/invite', 'tok'), env, fn);
    expect(res.status).toBe(200);
  });

  it('creates a pending invite with a code for a Pro user with no existing pairing', async () => {
    const { fn } = proBackend();
    const res = await handleBuddyInvite(authedRequest('/api/buddy/invite', 'tok'), ENV, fn);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; code: string };
    expect(body.ok).toBe(true);
    expect(body.code).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('refuses a second invite when already paired', async () => {
    const { fn } = proBackend((url, method) =>
      url.includes('focus_buddy_pairs') && method === 'GET'
        ? {
            status: 200,
            body: [
              { id: 'p1', user_a: 'user-1', user_b: null, invite_code: 'X', status: 'pending' },
            ],
          }
        : null,
    );
    const res = await handleBuddyInvite(authedRequest('/api/buddy/invite', 'tok'), ENV, fn);
    expect(res.status).toBe(409);
  });
});

describe('handleBuddyJoin', () => {
  it('joins a pending invite by code and never lets a user join their own invite', async () => {
    const { fn } = proBackend((url) => {
      if (url.includes('invite_code=eq.ABCDEFGH')) {
        return {
          status: 200,
          body: [
            {
              id: 'p1',
              user_a: 'user-2',
              user_b: null,
              invite_code: 'ABCDEFGH',
              status: 'pending',
            },
          ],
        };
      }
      return null;
    });
    const res = await handleBuddyJoin(
      authedRequest('/api/buddy/join', 'tok', { code: 'abcdefgh' }),
      ENV,
      fn,
    );
    expect(res.status).toBe(200);
  });

  it('rejects a missing code and joining your own invite', async () => {
    const { fn } = proBackend();
    expect(
      (await handleBuddyJoin(authedRequest('/api/buddy/join', 'tok', {}), ENV, fn)).status,
    ).toBe(400);

    const { fn: ownFn } = proBackend((url) =>
      url.includes('invite_code=eq.SELFSELF')
        ? {
            status: 200,
            body: [
              {
                id: 'p1',
                user_a: 'user-1',
                user_b: null,
                invite_code: 'SELFSELF',
                status: 'pending',
              },
            ],
          }
        : null,
    );
    const res = await handleBuddyJoin(
      authedRequest('/api/buddy/join', 'tok', { code: 'SELFSELF' }),
      ENV,
      ownFn,
    );
    expect(res.status).toBe(400);
  });
});

describe('handleBuddyStatus', () => {
  it('reports unpaired, pending-with-code, and accepted-with-minutes states', async () => {
    const { fn: unpaired } = proBackend();
    const r1 = await handleBuddyStatus(
      new Request('https://moneo.bond/api/buddy/status', {
        headers: { Authorization: 'Bearer tok' },
      }),
      ENV,
      unpaired,
    );
    expect(await r1.json()).toEqual({ paired: false });

    const { fn: pending } = proBackend((url, method) =>
      url.includes('focus_buddy_pairs') && method === 'GET'
        ? {
            status: 200,
            body: [
              {
                id: 'p1',
                user_a: 'user-1',
                user_b: null,
                invite_code: 'MYCODE1',
                status: 'pending',
              },
            ],
          }
        : null,
    );
    const r2 = await handleBuddyStatus(
      new Request('https://moneo.bond/api/buddy/status', {
        headers: { Authorization: 'Bearer tok' },
      }),
      ENV,
      pending,
    );
    expect(await r2.json()).toEqual({ paired: false, pendingCode: 'MYCODE1' });

    const { fn: accepted } = proBackend((url, method) => {
      if (url.includes('focus_buddy_pairs') && method === 'GET') {
        return {
          status: 200,
          body: [
            { id: 'p1', user_a: 'user-1', user_b: 'buddy-2', invite_code: 'X', status: 'accepted' },
          ],
        };
      }
      if (url.includes('focus_sessions')) {
        return { status: 200, body: [{ duration_min: 25 }, { duration_min: 15 }] };
      }
      return null;
    });
    const r3 = await handleBuddyStatus(
      new Request('https://moneo.bond/api/buddy/status', {
        headers: { Authorization: 'Bearer tok' },
      }),
      ENV,
      accepted,
    );
    expect(await r3.json()).toEqual({ paired: true, todayMinutes: 40 });
  });
});

describe('handleBuddyUnpair', () => {
  it('deletes the pairing scoped to either side of the caller', async () => {
    const { fn, calls } = proBackend();
    const res = await handleBuddyUnpair(authedRequest('/api/buddy/unpair', 'tok'), ENV, fn);
    expect(res.status).toBe(200);
    const del = calls.find((c) => c.method === 'DELETE');
    expect(del?.url).toBe(
      'https://xyz.supabase.co/rest/v1/focus_buddy_pairs?or=(user_a.eq.user-1,user_b.eq.user-1)',
    );
  });
});

describe('config guard', () => {
  it('503s every handler when Supabase env vars are missing', async () => {
    const { fn } = proBackend();
    const empty: FocusBuddyEnv = {};
    expect(
      (await handleBuddyInvite(authedRequest('/api/buddy/invite', 'tok'), empty, fn)).status,
    ).toBe(503);
    expect((await handleBuddyJoin(authedRequest('/api/buddy/join', 'tok'), empty, fn)).status).toBe(
      503,
    );
    expect(
      (await handleBuddyUnpair(authedRequest('/api/buddy/unpair', 'tok'), empty, fn)).status,
    ).toBe(503);
  });
});
