import { describe, expect, it } from 'vitest';

import {
  handleCalendarConnect,
  handleCalendarDisconnect,
  handleCalendarEvents,
  handleCalendarStatus,
  type CalendarEnv,
} from '../../cloudflare/workers/calendar';

const ENV: CalendarEnv = {
  SUPABASE_URL: 'https://xyz.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'srv-key',
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
};

interface RecordedCall {
  url: string;
  method: string;
}

function stubFetch(
  handler: (
    url: string,
    init: { method?: string; headers?: Record<string, string>; body?: unknown },
  ) => { status: number; body: unknown },
) {
  const calls: RecordedCall[] = [];
  const fn = (async (
    url: unknown,
    init?: { method?: string; headers?: Record<string, string>; body?: unknown },
  ) => {
    const u = String(url);
    calls.push({ url: u, method: init?.method ?? 'GET' });
    const r = handler(u, { method: init?.method, headers: init?.headers, body: init?.body });
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  return { fn, calls };
}

function authed(url: string, method: string, token = 'good-token'): Request {
  return new Request(`https://moneo.bond${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** A backend where the caller is a valid Pro user with no calendar connected yet. */
function proBackend(overrides: {
  connection?: { refresh_token: string; google_email: string | null; connected_at: string } | null;
  tokenExchange?: { status: number; body: unknown };
  googleEvents?: { status: number; body: unknown };
}) {
  return stubFetch((url, init) => {
    if (url.endsWith('/auth/v1/user')) {
      return init.headers?.['Authorization'] === 'Bearer good-token'
        ? { status: 200, body: { id: 'user-1' } }
        : { status: 401, body: {} };
    }
    if (url.includes('/rest/v1/subscriptions')) {
      return { status: 200, body: [{ status: 'active' }] };
    }
    if (url.includes('/rest/v1/google_calendar_connections')) {
      if (init.method === 'DELETE') return { status: 200, body: {} };
      if (init.method === 'POST') return { status: 200, body: {} };
      const row = overrides.connection;
      return { status: 200, body: row ? [{ user_id: 'user-1', ...row }] : [] };
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      return overrides.tokenExchange ?? { status: 200, body: { access_token: 'g-access' } };
    }
    if (url === 'https://oauth2.googleapis.com/revoke') {
      return { status: 200, body: {} };
    }
    if (url.startsWith('https://www.googleapis.com/calendar/v3/')) {
      return overrides.googleEvents ?? { status: 200, body: { items: [] } };
    }
    return { status: 404, body: {} };
  });
}

describe('handleCalendarConnect', () => {
  it('rejects non-POST', async () => {
    const { fn } = proBackend({});
    const res = await handleCalendarConnect(authed('/api/calendar/connect', 'GET'), ENV, fn);
    expect(res.status).toBe(405);
  });

  it('rejects missing/invalid auth', async () => {
    const { fn } = proBackend({});
    const noAuth = new Request('https://moneo.bond/api/calendar/connect', { method: 'POST' });
    expect((await handleCalendarConnect(noAuth, ENV, fn)).status).toBe(401);
    expect(
      (await handleCalendarConnect(authed('/api/calendar/connect', 'POST', 'bad'), ENV, fn)).status,
    ).toBe(401);
  });

  it('fails closed without backend secrets', async () => {
    const { fn } = proBackend({});
    const res = await handleCalendarConnect(authed('/api/calendar/connect', 'POST'), {}, fn);
    expect(res.status).toBe(503);
  });

  it('rejects a Free user (server-side gate, not just UI)', async () => {
    const { fn } = stubFetch((url) => {
      if (url.endsWith('/auth/v1/user')) return { status: 200, body: { id: 'user-1' } };
      if (url.includes('/rest/v1/subscriptions'))
        return { status: 200, body: [{ status: 'free' }] };
      return { status: 200, body: [] };
    });
    const req = new Request('https://moneo.bond/api/calendar/connect', {
      method: 'POST',
      headers: { Authorization: 'Bearer good-token' },
      body: JSON.stringify({ refreshToken: 'rt' }),
    });
    expect((await handleCalendarConnect(req, ENV, fn)).status).toBe(403);
  });

  it('rejects an oversized or missing refresh token', async () => {
    const { fn } = proBackend({});
    const missing = new Request('https://moneo.bond/api/calendar/connect', {
      method: 'POST',
      headers: { Authorization: 'Bearer good-token' },
      body: JSON.stringify({}),
    });
    expect((await handleCalendarConnect(missing, ENV, fn)).status).toBe(400);

    const tooLong = new Request('https://moneo.bond/api/calendar/connect', {
      method: 'POST',
      headers: { Authorization: 'Bearer good-token' },
      body: JSON.stringify({ refreshToken: 'x'.repeat(3000) }),
    });
    expect((await handleCalendarConnect(tooLong, ENV, fn)).status).toBe(400);
  });

  it('stores a valid refresh token for a Pro user', async () => {
    const { fn, calls } = proBackend({});
    const req = new Request('https://moneo.bond/api/calendar/connect', {
      method: 'POST',
      headers: { Authorization: 'Bearer good-token' },
      body: JSON.stringify({ refreshToken: 'rt-123', googleEmail: 'a@example.com' }),
    });
    const res = await handleCalendarConnect(req, ENV, fn);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(
      calls.some(
        (c) => c.url.includes('/rest/v1/google_calendar_connections') && c.method === 'POST',
      ),
    ).toBe(true);
  });
});

describe('handleCalendarStatus', () => {
  it('reports not connected when no row exists', async () => {
    const { fn } = proBackend({ connection: null });
    const res = await handleCalendarStatus(authed('/api/calendar/status', 'GET'), ENV, fn);
    expect(await res.json()).toEqual({ connected: false });
  });

  it('reports connected with the stored email', async () => {
    const { fn } = proBackend({
      connection: {
        refresh_token: 'rt',
        google_email: 'a@example.com',
        connected_at: '2026-01-01T00:00:00Z',
      },
    });
    const res = await handleCalendarStatus(authed('/api/calendar/status', 'GET'), ENV, fn);
    expect(await res.json()).toEqual({
      connected: true,
      googleEmail: 'a@example.com',
      connectedAt: '2026-01-01T00:00:00Z',
    });
  });
});

describe('handleCalendarEvents', () => {
  const url = '/api/calendar/events?start=2026-01-01T00:00:00.000Z&end=2026-01-08T00:00:00.000Z';

  it('rejects an invalid or unbounded range', async () => {
    const { fn } = proBackend({
      connection: { refresh_token: 'rt', google_email: null, connected_at: '' },
    });
    const bad = await handleCalendarEvents(
      authed('/api/calendar/events?start=x&end=y', 'GET'),
      ENV,
      fn,
    );
    expect(bad.status).toBe(400);
    const tooWide = await handleCalendarEvents(
      authed(
        '/api/calendar/events?start=2026-01-01T00:00:00.000Z&end=2026-06-01T00:00:00.000Z',
        'GET',
      ),
      ENV,
      fn,
    );
    expect(tooWide.status).toBe(400);
  });

  it('returns not_connected when no connection exists', async () => {
    const { fn } = proBackend({ connection: null });
    const res = await handleCalendarEvents(authed(url, 'GET'), ENV, fn);
    expect(res.status).toBe(404);
  });

  it('deletes the row and asks for reconnect on invalid_grant', async () => {
    const { fn, calls } = proBackend({
      connection: { refresh_token: 'stale', google_email: null, connected_at: '' },
      tokenExchange: { status: 400, body: { error: 'invalid_grant' } },
    });
    const res = await handleCalendarEvents(authed(url, 'GET'), ENV, fn);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'reconnect_required' });
    expect(
      calls.some(
        (c) => c.url.includes('/rest/v1/google_calendar_connections') && c.method === 'DELETE',
      ),
    ).toBe(true);
  });

  it('maps Google events into the minimal client shape', async () => {
    const { fn } = proBackend({
      connection: { refresh_token: 'rt', google_email: null, connected_at: '' },
      googleEvents: {
        status: 200,
        body: {
          items: [
            {
              id: 'g1',
              summary: 'Standup',
              start: { dateTime: '2026-01-05T09:00:00Z' },
              end: { dateTime: '2026-01-05T09:30:00Z' },
            },
            {
              id: 'g2',
              summary: 'Vacation',
              start: { date: '2026-01-06' },
              end: { date: '2026-01-07' },
            },
            { id: 'bad-no-times' },
          ],
        },
      },
    });
    const res = await handleCalendarEvents(authed(url, 'GET'), ENV, fn);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { events: unknown[] };
    expect(data.events).toEqual([
      {
        id: 'g1',
        title: 'Standup',
        startsAt: Date.parse('2026-01-05T09:00:00Z'),
        endsAt: Date.parse('2026-01-05T09:30:00Z'),
        allDay: false,
      },
      {
        id: 'g2',
        title: 'Vacation',
        startsAt: Date.parse('2026-01-06'),
        endsAt: Date.parse('2026-01-07'),
        allDay: true,
      },
    ]);
  });
});

describe('handleCalendarDisconnect', () => {
  it('deletes the row even if the Google revoke call fails', async () => {
    const { fn, calls } = stubFetch((url, init) => {
      if (url.endsWith('/auth/v1/user')) return { status: 200, body: { id: 'user-1' } };
      if (url.includes('/rest/v1/google_calendar_connections')) {
        if (init.method === 'DELETE') return { status: 200, body: {} };
        return {
          status: 200,
          body: [{ user_id: 'user-1', refresh_token: 'rt', google_email: null }],
        };
      }
      if (url === 'https://oauth2.googleapis.com/revoke') return { status: 500, body: {} };
      return { status: 200, body: [] };
    });
    const res = await handleCalendarDisconnect(authed('/api/calendar/disconnect', 'POST'), ENV, fn);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(calls.some((c) => c.url === 'https://oauth2.googleapis.com/revoke')).toBe(true);
    expect(
      calls.some(
        (c) => c.url.includes('/rest/v1/google_calendar_connections') && c.method === 'DELETE',
      ),
    ).toBe(true);
  });
});
