import { describe, expect, it } from 'vitest';
import type { FetchImpl } from '../../cloudflare/workers/account';
import { handleAIPlan } from '../../cloudflare/workers/ai';
import { AI_DAILY_RANK_BONUS, RANKS, nextAiBonusRank } from './xpCore';

describe('Pro rank reward table', () => {
  it('grows with the rank and starts at zero', () => {
    const bonuses = RANKS.map((r) => AI_DAILY_RANK_BONUS[r.id]);
    expect(bonuses[0]).toBe(0);
    for (let i = 1; i < bonuses.length; i++) {
      expect(bonuses[i]).toBeGreaterThanOrEqual(bonuses[i - 1]);
    }
  });

  it('names the next rank that raises the bonus', () => {
    expect(nextAiBonusRank('beginner')).toEqual({ id: 'apprentice', bonus: 5 });
    expect(nextAiBonusRank('master')).toBeNull();
  });
});

describe('included AI allowance with the rank bonus', () => {
  function req(ip: string): Request {
    const h = new Map([
      ['authorization', 'Bearer t'],
      ['cf-connecting-ip', ip],
    ]);
    return {
      method: 'POST',
      headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null },
      text: async () => JSON.stringify({ goal: 'Learn', horizonMonths: 3, hoursPerWeek: 5 }),
    } as unknown as Request;
  }
  const fetchImpl = (async (url: string) => {
    const u = String(url);
    if (u.includes('/chat/completions')) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ steps: [{ title: 'A' }] }) } }],
        }),
        { status: 200 },
      );
    }
    const body = u.includes('/rest/v1/subscriptions')
      ? [{ status: 'active', current_period_end: null }]
      : { id: 'u-9', email: 'u9@example.com' };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as FetchImpl;

  it('lets a Master use base + 30 plans a day', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const store = new Map<string, string>([
      [`ai-rank:u-9:${day}`, 'master'],
      [`ai-quota:u-9:${day}`, '31'],
    ]);
    const kv = {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => {
        store.set(k, v);
      },
    };
    const env = {
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'srv',
      AI_API_KEY: 'k',
      AI_DAILY_LIMIT: '2',
      KV_CACHE: kv,
    };
    // 31 used: allowed while under 2 + 30, refused at 32.
    expect((await handleAIPlan(req('r-1'), env, fetchImpl)).status).toBe(200);
    expect((await handleAIPlan(req('r-2'), env, fetchImpl)).status).toBe(429);
  });
});
