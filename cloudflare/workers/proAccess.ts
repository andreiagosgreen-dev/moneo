/**
 * Server-side Pro entitlement: paid Lemon row (`subscriptions`, read with the
 * service role) or the complimentary allowlist. Any lookup failure is Free.
 */

import type { FetchImpl } from './account';
import { hasComplimentaryPro, resolveComplimentaryAllowlist } from './complimentaryPro';
import { hasPaidProAccess } from './subscriptionAccess';

export interface ProAccessEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PRO_COMPLIMENTARY_EMAILS?: string;
}

export async function hasServerProAccess(
  env: ProAccessEnv,
  userId: string,
  email: string | null,
  fetchImpl: FetchImpl,
): Promise<boolean> {
  if (hasComplimentaryPro(email, resolveComplimentaryAllowlist(env.PRO_COMPLIMENTARY_EMAILS))) {
    return true;
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const res = await fetchImpl(
      `${env.SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=status,current_period_end&limit=1`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{
      status?: string;
      current_period_end?: string | null;
    }>;
    return hasPaidProAccess(rows[0]?.status, rows[0]?.current_period_end);
  } catch {
    return false;
  }
}
