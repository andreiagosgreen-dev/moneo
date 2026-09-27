import { describe, expect, it } from 'vitest';

import { requestAccountDeletion } from './accountDeletionClient';

function fetchReturning(res: Response | Error) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (res instanceof Error) throw res;
    return res;
  }) as typeof fetch;
  return { fn, calls };
}

describe('requestAccountDeletion', () => {
  it('is true only when the Worker confirms { ok: true }', async () => {
    const { fn, calls } = fetchReturning(new Response(JSON.stringify({ ok: true })));
    await expect(requestAccountDeletion('tok', fn)).resolves.toBe(true);
    expect(calls[0].url).toBe('/api/account/delete');
    expect(calls[0].init?.method).toBe('POST');
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('rejects a 200 that is not the Worker confirmation (SPA fallback HTML)', async () => {
    const { fn } = fetchReturning(new Response('<!doctype html><html></html>', { status: 200 }));
    await expect(requestAccountDeletion('tok', fn)).resolves.toBe(false);
  });

  it('rejects a 200 JSON body without ok: true', async () => {
    const { fn } = fetchReturning(new Response(JSON.stringify({ ok: 'yes' })));
    await expect(requestAccountDeletion('tok', fn)).resolves.toBe(false);
  });

  it('rejects server errors and network failures', async () => {
    const err = fetchReturning(
      new Response(JSON.stringify({ error: 'Failed to delete user', step: 'auth' }), {
        status: 500,
      }),
    );
    await expect(requestAccountDeletion('tok', err.fn)).resolves.toBe(false);
    const down = fetchReturning(new Error('offline'));
    await expect(requestAccountDeletion('tok', down.fn)).resolves.toBe(false);
  });
});
