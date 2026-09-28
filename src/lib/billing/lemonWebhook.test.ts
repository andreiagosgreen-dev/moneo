// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FetchImpl } from '../../../cloudflare/workers/account';
import {
  handleLemonSqueezyWebhook,
  lemonUpdatedAt,
  type LemonWebhookEnv,
} from '../../../cloudflare/workers/lemonWebhook';
import { createReplayGuard } from '../../../cloudflare/workers/security';

const SECRET = 'whsec-test';
const ENV: LemonWebhookEnv = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'srv',
  LEMON_SQUEEZY_WEBHOOK_SECRET: SECRET,
};

async function sign(body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function signedRequest(body: string, signature?: string): Promise<Request> {
  return new Request('https://moneo.bond/api/webhook/lemonsqueezy', {
    method: 'POST',
    headers: { 'x-signature': signature ?? (await sign(body)) },
    body,
  });
}

function payload(
  overrides: {
    event?: string;
    updatedAt?: string;
    status?: string;
    testMode?: boolean;
  } = {},
): string {
  return JSON.stringify({
    meta: {
      event_name: overrides.event ?? 'subscription_updated',
      test_mode: overrides.testMode ?? false,
      custom_data: { user_id: 'user-1' },
    },
    data: {
      id: 'sub-1',
      attributes: {
        customer_id: 42,
        status: overrides.status ?? 'active',
        product_name: 'Moneo Pro (Monthly)',
        renews_at: '2030-01-01T00:00:00.000Z',
        updated_at: overrides.updatedAt ?? '2026-09-28T10:00:00.000Z',
      },
    },
  });
}

interface FakeDb {
  fetch: FetchImpl;
  writes: Array<Record<string, unknown>>;
}

/**
 * PostgREST stand-in. `stored` is the current `lemon_updated_at`;
 * `columnMissing` simulates migration 0012 not being applied.
 */
function fakeDb(
  opts: {
    stored?: string | null;
    columnMissing?: boolean;
    writeStatuses?: number[];
  } = {},
): FakeDb {
  const writes: Array<Record<string, unknown>> = [];
  const statuses = [...(opts.writeStatuses ?? [])];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const impl = async (url: string, init?: RequestInit) => {
    if (!init?.method || init.method === 'GET') {
      if (opts.columnMissing) return json({ code: '42703' }, 400);
      return json(opts.stored === undefined ? [] : [{ lemon_updated_at: opts.stored }]);
    }
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (opts.columnMissing && 'lemon_updated_at' in body) {
      return json({ code: 'PGRST204' }, 400);
    }
    const status = statuses.shift() ?? 201;
    if (status < 300) writes.push(body);
    return new Response(null, { status });
  };
  return { fetch: impl as unknown as FetchImpl, writes };
}

describe('lemon webhook — signature', () => {
  it('rejects unsigned and tampered requests with 401', async () => {
    const db = fakeDb();
    const body = payload();
    const unsigned = new Request('https://moneo.bond/api/webhook/lemonsqueezy', {
      method: 'POST',
      body,
    });
    expect((await handleLemonSqueezyWebhook(unsigned, ENV, db.fetch)).status).toBe(401);
    const tampered = await signedRequest(body, await sign(body + 'x'));
    expect((await handleLemonSqueezyWebhook(tampered, ENV, db.fetch)).status).toBe(401);
    expect(db.writes).toHaveLength(0);
  });
});

describe('lemon webhook — idempotency', () => {
  it('a failed write answers 5xx and the identical retry is applied, not deduped', async () => {
    const guard = createReplayGuard(3_600_000);
    const db = fakeDb({ writeStatuses: [500, 201] });
    const body = payload();

    const first = await handleLemonSqueezyWebhook(await signedRequest(body), ENV, db.fetch, guard);
    expect(first.status).toBe(500);
    expect(db.writes).toHaveLength(0);

    const retry = await handleLemonSqueezyWebhook(await signedRequest(body), ENV, db.fetch, guard);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ ok: true, event: 'subscription_updated' });
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({ user_id: 'user-1', status: 'active' });
  });

  it('dedupes an identical delivery after success', async () => {
    const guard = createReplayGuard(3_600_000);
    const db = fakeDb();
    const body = payload();
    await handleLemonSqueezyWebhook(await signedRequest(body), ENV, db.fetch, guard);
    const again = await handleLemonSqueezyWebhook(await signedRequest(body), ENV, db.fetch, guard);
    expect(await again.json()).toMatchObject({ deduped: true });
    expect(db.writes).toHaveLength(1);
  });

  it('applies a second, newer subscription_updated for the same subscription', async () => {
    const guard = createReplayGuard(3_600_000);
    const db = fakeDb();
    const a = payload({ updatedAt: '2026-09-28T10:00:00.000Z' });
    const b = payload({ updatedAt: '2026-09-28T10:05:00.000Z', status: 'cancelled' });
    await handleLemonSqueezyWebhook(await signedRequest(a), ENV, db.fetch, guard);
    const second = await handleLemonSqueezyWebhook(await signedRequest(b), ENV, db.fetch, guard);
    expect(second.status).toBe(200);
    expect(db.writes).toHaveLength(2);
    expect(db.writes[1]).toMatchObject({ status: 'cancelled' });
  });

  it('a DB read failure answers 5xx without marking the event seen', async () => {
    const guard = createReplayGuard(3_600_000);
    const broken = (async () => new Response('{}', { status: 503 })) as unknown as FetchImpl;
    const body = payload();
    const first = await handleLemonSqueezyWebhook(await signedRequest(body), ENV, broken, guard);
    expect(first.status).toBe(500);
    const db = fakeDb();
    const retry = await handleLemonSqueezyWebhook(await signedRequest(body), ENV, db.fetch, guard);
    expect(retry.status).toBe(200);
    expect(db.writes).toHaveLength(1);
  });
});

describe('lemon webhook — test mode', () => {
  it('acknowledges test_mode events without granting Pro', async () => {
    const db = fakeDb();
    const res = await handleLemonSqueezyWebhook(
      await signedRequest(payload({ testMode: true })),
      ENV,
      db.fetch,
      createReplayGuard(3_600_000),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ignored: 'test_mode' });
    expect(db.writes).toHaveLength(0);
  });

  it('processes test_mode events when ALLOW_TEST_MODE is "true"', async () => {
    const db = fakeDb();
    const res = await handleLemonSqueezyWebhook(
      await signedRequest(payload({ testMode: true })),
      { ...ENV, ALLOW_TEST_MODE: 'true' },
      db.fetch,
      createReplayGuard(3_600_000),
    );
    expect(res.status).toBe(200);
    expect(db.writes).toHaveLength(1);
  });
});

describe('lemon webhook — ordering', () => {
  it('skips an event older than the stored lemon_updated_at', async () => {
    const db = fakeDb({ stored: '2026-09-28T12:00:00.000Z' });
    const res = await handleLemonSqueezyWebhook(
      await signedRequest(payload({ updatedAt: '2026-09-28T11:00:00.000Z', status: 'expired' })),
      ENV,
      db.fetch,
      createReplayGuard(3_600_000),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ skipped: 'stale' });
    expect(db.writes).toHaveLength(0);
  });

  it('stores lemon_updated_at on newer (or equal) events', async () => {
    const db = fakeDb({ stored: '2026-09-28T09:00:00.000Z' });
    const res = await handleLemonSqueezyWebhook(
      await signedRequest(payload({ updatedAt: '2026-09-28T10:00:00Z' })),
      ENV,
      db.fetch,
      createReplayGuard(3_600_000),
    );
    expect(res.status).toBe(200);
    expect(db.writes[0]).toMatchObject({ lemon_updated_at: '2026-09-28T10:00:00.000Z' });
  });

  it('without the column (0012 not applied) writes the legacy row, no ordering check', async () => {
    const db = fakeDb({ columnMissing: true });
    const res = await handleLemonSqueezyWebhook(
      await signedRequest(payload()),
      ENV,
      db.fetch,
      createReplayGuard(3_600_000),
    );
    expect(res.status).toBe(200);
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).not.toHaveProperty('lemon_updated_at');
  });

  it('normalizes Lemon timestamps and rejects junk', () => {
    expect(lemonUpdatedAt({ updated_at: '2026-09-28T10:00:00Z' })).toBe('2026-09-28T10:00:00.000Z');
    expect(lemonUpdatedAt({ updated_at: 'nope' })).toBeNull();
    expect(lemonUpdatedAt({})).toBeNull();
  });
});
