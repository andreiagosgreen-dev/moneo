/**
 * Lemon Squeezy integration for Moneo billing.
 * Uses checkout URLs for subscription management.
 */

import { readEnv } from '../env';
import type { TKey } from '../i18n/types';

export type Plan = 'free' | 'pro-monthly' | 'pro-yearly';

export interface Pricing {
  id: Plan;
  name: TKey;
  description: TKey;
  price: string;
  priceMonthly: string;
  features: TKey[];
}

const PRICING_PLANS: Pricing[] = [
  {
    id: 'free',
    name: 'pricing.plan.free.name',
    description: 'pricing.plan.free.description',
    price: '$0',
    priceMonthly: '$0',
    features: [
      'pricing.feature.unlimitedSessions',
      'pricing.feature.threeProjects',
      'pricing.feature.ivyFrog',
      'pricing.feature.habitsJournalEnergy',
      'pricing.feature.localFirst',
    ],
  },
  {
    id: 'pro-monthly',
    name: 'pricing.plan.proMonthly.name',
    description: 'pricing.plan.proMonthly.description',
    price: '$5.99',
    priceMonthly: '$5.99',
    features: [
      'pricing.feature.allFree',
      'pricing.feature.unlimitedProjects',
      'pricing.feature.fullAi',
      'pricing.feature.reportsExport',
      'pricing.feature.timeBlocking',
      'pricing.feature.cloudSync',
      'pricing.feature.premiumThemes',
      'pricing.feature.prioritySupport',
    ],
  },
  {
    id: 'pro-yearly',
    name: 'pricing.plan.proYearly.name',
    description: 'pricing.plan.proYearly.description',
    price: '$59.99',
    priceMonthly: '$5.00',
    features: [
      'pricing.feature.allPro',
      'pricing.feature.twoMonthsFree',
      'pricing.feature.earlyAccess',
      'pricing.feature.prioritySupport',
    ],
  },
];

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
 * configured (free plan or missing env). The configured base must be a
 * real https: URL — anything else fails closed instead of open-redirecting
 * the buyer (Faza 5A).
 */
export function buildCheckoutUrl(planId: Plan, userId: string): string | null {
  const config = getLemonSqueezyConfig();
  if (planId === 'free' || !config.checkoutUrl || !config.storeId) {
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
  const variant = variantForPlan(planId);
  const path = variant ? `${base}/buy/${variant}` : base;
  return `${path}?checkout[custom][user_id]=${encodeURIComponent(userId)}`;
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

export function getPricingPlans(): Pricing[] {
  return PRICING_PLANS.map((plan) => ({ ...plan }));
}

export function initiateCheckout(planId: Plan, userId: string): string | null {
  return buildCheckoutUrl(planId, userId);
}

export function getProPlanCheckoutUrl(userId: string): string | null {
  return initiateCheckout('pro-monthly', userId);
}
