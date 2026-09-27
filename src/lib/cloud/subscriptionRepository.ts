import { getSupabaseClient } from '../supabase';
import { hasPaidProAccess } from '../billing/subscriptionAccess';

export interface SubscriptionInfo {
  status: 'free' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'paused' | 'unpaid';
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

/** A Lemon subscription that will charge again unless the buyer cancels it. */
export function hasRenewingSubscription(sub: SubscriptionInfo): boolean {
  return sub.planId !== 'free' && (sub.status === 'active' || sub.status === 'past_due');
}

/** Cancelled in Lemon but still paid up — Pro until `currentPeriodEnd`. */
export function isCancelledButActive(sub: SubscriptionInfo): boolean {
  return sub.status === 'cancelled' && sub.isPro;
}

export function toSubscriptionInfo(
  row: { status?: string | null; plan_id?: string | null; current_period_end?: string | null },
  now: number = Date.now(),
): SubscriptionInfo {
  const currentPeriodEnd = row.current_period_end
    ? new Date(row.current_period_end).getTime()
    : null;
  return {
    status: (row.status as SubscriptionInfo['status']) || 'free',
    planId: (row.plan_id as SubscriptionInfo['planId']) || 'free',
    currentPeriodEnd,
    isPro: hasPaidProAccess(row.status, currentPeriodEnd, now),
  };
}

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
    return toSubscriptionInfo(data);
  } catch {
    return DEFAULT_FREE_SUBSCRIPTION;
  }
}
