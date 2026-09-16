import { getSupabaseClient } from '../supabase';

export interface SubscriptionInfo {
  status: 'free' | 'active' | 'past_due' | 'cancelled';
  planId: 'free' | 'pro-monthly' | 'pro-yearly';
  currentPeriodEnd: number | null;
  isPro: boolean;
}

export const DEFAULT_FREE_SUBSCRIPTION: SubscriptionInfo = {
  status: 'free',
  planId: 'free',
  currentPeriodEnd: null,
  isPro: false,
};

/**
 * Fetches user subscription details from Supabase.
 */
export async function fetchSubscription(userId: string): Promise<SubscriptionInfo> {
  const client = await getSupabaseClient();
  if (!client) return DEFAULT_FREE_SUBSCRIPTION;

  try {
    const { data, error } = await client
      .from('subscriptions')
      .select('status, plan_id, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return DEFAULT_FREE_SUBSCRIPTION;

    const isPro = data.status === 'active';
    return {
      status: (data.status as SubscriptionInfo['status']) || 'free',
      planId: (data.plan_id as SubscriptionInfo['planId']) || 'free',
      currentPeriodEnd: data.current_period_end
        ? new Date(data.current_period_end).getTime()
        : null,
      isPro,
    };
  } catch {
    return DEFAULT_FREE_SUBSCRIPTION;
  }
}
