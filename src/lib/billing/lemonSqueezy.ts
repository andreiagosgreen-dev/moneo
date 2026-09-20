/**
 * Lemon Squeezy integration for Moneo billing.
 * Uses checkout URLs for subscription management.
 */

import { readEnv } from '../env';

export type Plan = 'free' | 'pro-monthly' | 'pro-yearly';

export interface Pricing {
  id: Plan;
  name: string;
  description: string;
  price: string;
  priceMonthly: string;
  features: string[];
}

const PRICING_PLANS: Pricing[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: '$0',
    priceMonthly: '$0',
    features: [
      'Unlimited focus sessions',
      '3 projects + task manager',
      'Ivy Lee planner + daily frog',
      'Habits, journal & energy',
      'Local-first, private by design',
    ],
  },
  {
    id: 'pro-monthly',
    name: 'Pro (Monthly)',
    description: 'For serious focus practitioners',
    price: '$9',
    priceMonthly: '$9',
    features: [
      'All Free features',
      'Unlimited projects, goals & OKRs',
      'Full AI assistant + all insights',
      'Reports, CSV/PDF export & billable time',
      'Time blocking, sprints & kanban',
      'Cloud sync across devices',
      'Premium themes & customization',
      'Priority support',
    ],
  },
  {
    id: 'pro-yearly',
    name: 'Pro (Yearly)',
    description: 'Best value - 2 months free',
    price: '$90',
    priceMonthly: '$7.50',
    features: [
      'All Pro features',
      '2 months free',
      'Early access to new features',
      'Priority support',
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

export function getPricingPlans(): Pricing[] {
  return PRICING_PLANS.map((plan) => ({ ...plan }));
}

export function initiateCheckout(planId: Plan, userId: string): string | null {
  return buildCheckoutUrl(planId, userId);
}

export function getProPlanCheckoutUrl(userId: string): string | null {
  return initiateCheckout('pro-monthly', userId);
}
