import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BUDDY_STATUS,
  fetchBuddyStatus,
  inviteBuddy,
  joinBuddy,
  unpairBuddy,
} from './focusBuddyClient';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fail-open behavior', () => {
  it('fetchBuddyStatus falls back to the default on network error or non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('offline')),
    );
    expect(await fetchBuddyStatus('tok')).toEqual(DEFAULT_BUDDY_STATUS);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    expect(await fetchBuddyStatus('tok')).toEqual(DEFAULT_BUDDY_STATUS);
  });

  it('inviteBuddy/joinBuddy/unpairBuddy fail closed (null/false) on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await inviteBuddy('tok')).toBeNull();
    expect(await joinBuddy('tok', 'ABCDEFGH')).toBe(false);
    expect(await unpairBuddy('tok')).toBe(false);
  });
});

describe('happy path', () => {
  it('fetchBuddyStatus parses a paired response with todayMinutes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ paired: true, todayMinutes: 40 }), { status: 200 }),
      ),
    );
    expect(await fetchBuddyStatus('tok')).toEqual({ paired: true, todayMinutes: 40 });
  });

  it('inviteBuddy returns the code on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, code: 'ABCDEFGH' }), { status: 200 }),
      ),
    );
    expect(await inviteBuddy('tok')).toBe('ABCDEFGH');
  });

  it('joinBuddy/unpairBuddy return true on a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    expect(await joinBuddy('tok', 'ABCDEFGH')).toBe(true);
    expect(await unpairBuddy('tok')).toBe(true);
  });
});
