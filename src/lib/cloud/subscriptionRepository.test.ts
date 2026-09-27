import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock('../supabase', () => ({
  getSupabaseClient: () => getSupabaseClient(),
}));

import { DEFAULT_FREE_SUBSCRIPTION, fetchSubscription } from './subscriptionRepository';

beforeEach(() => {
  getSupabaseClient.mockReset();
});

describe('fetchSubscription', () => {
  it('maps active status to isPro', async () => {
    getSupabaseClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                status: 'active',
                plan_id: 'pro-monthly',
                current_period_end: '2026-10-25T15:20:41Z',
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    const sub = await fetchSubscription('user-1');
    expect(sub).toMatchObject({
      status: 'active',
      planId: 'pro-monthly',
      isPro: true,
    });
    expect(sub.currentPeriodEnd).toBe(Date.parse('2026-10-25T15:20:41Z'));
  });

  it('returns free when there is no client', async () => {
    getSupabaseClient.mockResolvedValue(null);
    expect(await fetchSubscription('user-1')).toEqual(DEFAULT_FREE_SUBSCRIPTION);
  });

  it('returns free when the row is missing', async () => {
    getSupabaseClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    });
    expect(await fetchSubscription('user-1')).toEqual(DEFAULT_FREE_SUBSCRIPTION);
  });
});
