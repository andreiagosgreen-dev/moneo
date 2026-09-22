/**
 * Lemon Squeezy Customer Portal session (server-side only).
 *
 * The browser never holds the Lemon Squeezy API key. The Worker verifies
 * the caller's Supabase JWT, resolves their lemon_customer_id /
 * lemon_subscription_id from the subscriptions table (service role) and
 * returns the pre-signed `customer_portal` URL from the Lemon Squeezy API
 * (valid 24h). Cancel, upgrade and downgrade all happen inside that
 * portal — Moneo builds no custom billing mutation UI.
 */

import { bearerToken, verifyUserToken } from './account';
import { buildSecurityHeaders, mergeHeaders } from './security';

export interface PortalEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LEMON_SQUEEZY_API_KEY?: string;
}

export type FetchImpl = typeof fetch;

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(buildSecurityHeaders(), { 'Content-Type': 'application/json' }),
  });
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Extract the pre-signed Customer Portal URL from a Lemon Squeezy
 * get-customer / get-subscription API payload. Pure — safe to unit test.
 * Returns null for anything that is not a real https: portal URL.
 */
export function extractCustomerPortalUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const attributes = (data as { attributes?: unknown }).attributes;
  if (!attributes || typeof attributes !== 'object') return null;
  const urls = (attributes as { urls?: unknown }).urls;
  if (!urls || typeof urls !== 'object') return null;
  const candidate = (urls as { customer_portal?: unknown }).customer_portal;
  return isHttpsUrl(candidate) ? candidate : null;
}

/**
 * Fetch the portal URL from the Lemon Squeezy API. Prefers the subscription
 * endpoint (portal scoped to that subscription), falls back to the customer
 * endpoint. Never throws; null means "unavailable, retry later".
 */
export async function fetchCustomerPortalUrl(
  opts: {
    apiKey: string;
    customerId?: string | null;
    subscriptionId?: string | null;
  },
  fetchImpl: FetchImpl = fetch,
): Promise<string | null> {
  const { apiKey, customerId, subscriptionId } = opts;
  if (!apiKey) return null;
  const headers = {
    Accept: 'application/vnd.api+json',
    Authorization: `Bearer ${apiKey}`,
  };
  const tryPaths: string[] = [];
  if (subscriptionId) tryPaths.push(`subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (customerId) tryPaths.push(`customers/${encodeURIComponent(customerId)}`);
  for (const path of tryPaths) {
    try {
      const res = await fetchImpl(`https://api.lemonsqueezy.com/v1/${path}`, { headers });
      if (!res.ok) continue;
      const payload: unknown = await res.json();
      const url = extractCustomerPortalUrl(payload);
      if (url) return url;
    } catch {
      /* try the next path */
    }
  }
  return null;
}

interface SubscriptionIds {
  customerId: string | null;
  subscriptionId: string | null;
}

async function lookupSubscriptionIds(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  fetchImpl: FetchImpl,
): Promise<SubscriptionIds | null> {
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=lemon_customer_id,lemon_subscription_id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      lemon_customer_id?: unknown;
      lemon_subscription_id?: unknown;
    }>;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return { customerId: null, subscriptionId: null };
    return {
      customerId:
        typeof row.lemon_customer_id === 'string' && row.lemon_customer_id.length > 0
          ? row.lemon_customer_id
          : null,
      subscriptionId:
        typeof row.lemon_subscription_id === 'string' && row.lemon_subscription_id.length > 0
          ? row.lemon_subscription_id
          : null,
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/billing/portal — returns `{ url }` for the caller's Customer
 * Portal session. Identity comes only from the JWT; the Lemon Squeezy API
 * key never leaves the Worker. Fail-closed everywhere.
 */
export async function handleCustomerPortal(
  request: Request,
  env: PortalEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Billing portal is not configured' }, 503);
  }
  if (!env.LEMON_SQUEEZY_API_KEY) {
    return json({ error: 'Billing portal is not configured' }, 503);
  }
  const token = bearerToken(request);
  if (!token) {
    return json({ error: 'Missing or invalid authorization' }, 401);
  }
  const userId = await verifyUserToken(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    token,
    fetchImpl,
  );
  if (!userId) {
    return json({ error: 'Invalid or expired session' }, 401);
  }
  const ids = await lookupSubscriptionIds(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    userId,
    fetchImpl,
  );
  if (!ids || (!ids.customerId && !ids.subscriptionId)) {
    return json({ error: 'No subscription found for this account' }, 404);
  }
  const url = await fetchCustomerPortalUrl(
    {
      apiKey: env.LEMON_SQUEEZY_API_KEY,
      customerId: ids.customerId,
      subscriptionId: ids.subscriptionId,
    },
    fetchImpl,
  );
  if (!url) {
    return json({ error: 'Could not create a portal session' }, 502);
  }
  return json({ url }, 200);
}
