/**
 * Lemon Squeezy integration for Moneo billing.
 * Checkout URLs + customer-portal session helper. Display copy
 * (names, prices, features) lives in pricingConfig — this module
 * never hardcodes marketing text.
 */

import { currentSource } from '../attribution';
import { cleanTag } from '../attributionTags';
import { readEnv } from '../env';
import { en } from '../i18n/locales/en';
import { PRICING_PLANS_DISPLAY, PRO_PRICES, type PlanId } from './pricingConfig';

export type Plan = PlanId;

export interface Pricing {
  id: Plan;
  name: string;
  description: string;
  price: string;
  priceMonthly: string;
  features: string[];
}

/**
 * Backward-compatible English snapshot of the canonical pricing config.
 * Descriptions/features resolve through the en dict so the config's TKeys
 * stay the single source (no duplicated literals here).
 */
export function getPricingPlans(): Pricing[] {
  return PRICING_PLANS_DISPLAY.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: en[plan.descKey] ?? plan.id,
    price: plan.price,
    priceMonthly: plan.id === 'pro-yearly' ? PRO_PRICES.yearlyMonthly : plan.price,
    features: plan.featureKeys.map((k) => en[k] ?? k),
  }));
}

export function getLemonSqueezyConfig(): {
  storeId: string | null;
  checkoutUrl: string | null;
  monthlyVariantId: string | null;
  yearlyVariantId: string | null;
} {
  const storeId = readEnv().VITE_LEMONSQUEEZY_STORE_ID;
  const checkoutBaseUrl = readEnv().VITE_LEMONSQUEEZY_CHECKOUT_URL;

  return {
    storeId: storeId || null,
    checkoutUrl: checkoutBaseUrl || null,
    monthlyVariantId: readEnv().VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID || null,
    yearlyVariantId: readEnv().VITE_LEMONSQUEEZY_YEARLY_VARIANT_ID || null,
  };
}

function variantForPlan(planId: Plan): string | null {
  const config = getLemonSqueezyConfig();
  if (planId === 'pro-monthly') return config.monthlyVariantId;
  if (planId === 'pro-yearly') return config.yearlyVariantId;
  return null;
}

/**
 * Checkout URL for a paid plan. Uses the plan's distinct variant id so
 * monthly and yearly open different checkouts; the user id is URL-encoded
 * so the webhook can attribute the subscription. Null when billing is not
 * configured (free plan, missing store/base/variant, or non-https base).
 * Fail-closed: never invent a buy URL or open-redirect the buyer (Faza 5A).
 * A Lemon discount code (uppercase letters/digits) is prefilled when given.
 */
export function buildCheckoutUrl(
  planId: Plan,
  userId: string,
  discountCode?: string,
  email?: string | null,
  channel?: { source: string; campaign: string },
): string | null {
  const config = getLemonSqueezyConfig();
  const variant = variantForPlan(planId);
  if (planId === 'free' || !config.checkoutUrl || !config.storeId || !variant) {
    return null;
  }
  let base: string;
  try {
    const parsed = new URL(config.checkoutUrl.replace(/\/$/, ''));
    if (parsed.protocol !== 'https:' || !parsed.hostname) return null;
    base = parsed.href.replace(/\/$/, '');
  } catch {
    return null;
  }
  let url = `${base}/buy/${variant}?checkout[custom][user_id]=${encodeURIComponent(userId)}`;
  // Prefill the account email so the Lemon customer matches the Moneo account
  // (support lookups, and cancelling every subscription on account deletion).
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    url += `&checkout[email]=${encodeURIComponent(email)}`;
  }
  // Channel label (e.g. "tiktok") so the webhook can count paid sign-ups by source.
  const src = cleanTag(channel?.source);
  if (src) {
    url += `&checkout[custom][src]=${src}`;
    const cmp = cleanTag(channel?.campaign);
    if (cmp) url += `&checkout[custom][cmp]=${cmp}`;
  }
  if (discountCode && /^[A-Z0-9]{3,64}$/.test(discountCode)) {
    return `${url}&checkout[discount_code]=${discountCode}`;
  }
  return url;
}

/**
 * Lemon Squeezy's self-service customer portal (`/billing` on the store's
 * own domain — the buyer enters their email there for a magic link; no
 * account id needed client-side). Fails closed the same way
 * `buildCheckoutUrl` does: a bad/missing base URL returns null rather
 * than an open redirect.
 */
export function buildCustomerPortalUrl(): string | null {
  const config = getLemonSqueezyConfig();
  if (!config.checkoutUrl) return null;
  try {
    const parsed = new URL(config.checkoutUrl.replace(/\/$/, ''));
    if (parsed.protocol !== 'https:' || !parsed.hostname) return null;
    return `${parsed.protocol}//${parsed.host}/billing`;
  } catch {
    return null;
  }
}

/**
 * Lemon Squeezy's buyer-wide order history. Works for any store without
 * configuration — the last resort when the store portal URL can't be built.
 */
export const LEMON_MY_ORDERS_URL = 'https://app.lemonsqueezy.com/my-orders';

/**
 * A portal URL that needs no server secret: the store's `/billing` portal
 * when the checkout base is configured, otherwise Lemon's "My Orders".
 */
export function fallbackCustomerPortalUrl(): string {
  return buildCustomerPortalUrl() ?? LEMON_MY_ORDERS_URL;
}

export function initiateCheckout(
  planId: Plan,
  userId: string,
  email?: string | null,
): string | null {
  return buildCheckoutUrl(planId, userId, undefined, email, currentSource());
}

/* ---------------- Customer Portal (self-serve billing) ---------------- */

export interface CustomerPortalResult {
  ok: boolean;
  url: string | null;
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
 * Ask the same-origin Worker for a Lemon Squeezy Customer Portal URL and
 * open cancel/upgrade/downgrade there — never a custom billing mutation.
 * The browser only presents the Supabase access token it already holds;
 * the Lemon Squeezy API key stays server-side. Fail-closed: null means
 * "unavailable", never a guessed URL.
 */
export async function requestCustomerPortalUrl(
  getAccessToken: () => Promise<string | null>,
  fetchFn: typeof fetch = fetch,
): Promise<CustomerPortalResult> {
  try {
    const token = await getAccessToken();
    if (!token) return { ok: false, url: null };
    const res = await fetchFn('/api/billing/portal', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, url: null };
    const body = (await res.json()) as { url?: unknown };
    const url = body?.url;
    return isHttpsUrl(url) ? { ok: true, url } : { ok: false, url: null };
  } catch {
    return { ok: false, url: null };
  }
}

/**
 * Best portal URL available: the Worker's pre-signed, subscription-scoped
 * session when `LEMON_SQUEEZY_API_KEY` is set on the Worker, otherwise the
 * secret-free fallback (buyer signs in with their email there).
 */
export async function resolveCustomerPortalUrl(
  getAccessToken: () => Promise<string | null>,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const signed = await requestCustomerPortalUrl(getAccessToken, fetchFn);
  return signed.ok && signed.url ? signed.url : fallbackCustomerPortalUrl();
}

/** Resolve the Supabase access token for the portal call. Null when offline. */
export async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const { getSupabaseClient } = await import('../supabase');
    const client = await getSupabaseClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    const token = data?.session?.access_token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}
