/**
 * Lemon Squeezy integration for Moneo billing.
 * Uses checkout URLs for subscription management.
 */

export type Plan = "free" | "pro-monthly" | "pro-yearly";

export interface Pricing {
  id: Plan;
  name: string;
  description: string;
  price: string;
  priceMonthly: string;
  features: string[];
  checkoutUrl: string | null;
}

const PRICING_PLANS: Pricing[] = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for getting started",
    price: "$0",
    priceMonthly: "$0",
    features: [
      "Unlimited focus sessions",
      "Local storage only",
      "Basic statistics",
      "Single device",
    ],
    checkoutUrl: null,
  },
  {
    id: "pro-monthly",
    name: "Pro (Monthly)",
    description: "For serious focus practitioners",
    price: "$9",
    priceMonthly: "$9",
    features: [
      "All Free features",
      "Cloud sync across devices",
      "Advanced analytics",
      "Focus areas & intentions",
      "Session export",
      "Priority support",
    ],
    checkoutUrl: null,
  },
  {
    id: "pro-yearly",
    name: "Pro (Yearly)",
    description: "Best value - 2 months free",
    price: "$90",
    priceMonthly: "$7.50",
    features: [
      "All Pro features",
      "2 months free",
      "Early access to new features",
      "Priority support",
    ],
    checkoutUrl: null,
  },
];

function readEnv(): Record<string, string | undefined> {
  try {
    const meta = import.meta as unknown as {
      env?: Record<string, string | undefined>;
    };
    return meta.env ?? {};
  } catch {
    return {};
  }
}

export function getLemonSqueezyConfig(): {
  storeId: string | null;
  checkoutUrl: string | null;
} {
  const storeId = readEnv().VITE_LEMONSQUEZY_STORE_ID;
  const checkoutBaseUrl = readEnv().VITE_LEMONSQUEZY_CHECKOUT_URL;

  return {
    storeId: storeId || null,
    checkoutUrl: checkoutBaseUrl || null,
  };
}

export function getPricingPlans(): Pricing[] {
  const config = getLemonSqueezyConfig();

  return PRICING_PLANS.map((plan) => {
    if (plan.id === "free" || !config.checkoutUrl || !config.storeId) {
      return plan;
    }

    // Generate checkout URL for paid plans
    // Format: https://store.lemonsqueezy.com/checkout?variant_id=XYZ
    // In production, you would map plan IDs to actual Lemon Squeezy variant IDs
    return {
      ...plan,
      checkoutUrl: `${config.checkoutUrl}?checkout[custom][user_id]=USER_ID`,
    };
  });
}

export function initiateCheckout(planId: Plan, userId: string): string | null {
  const plans = getPricingPlans();
  const plan = plans.find((p) => p.id === planId);

  if (!plan || !plan.checkoutUrl) {
    return null;
  }

  // Replace USER_ID placeholder with actual user ID
  return plan.checkoutUrl.replace("USER_ID", userId);
}

export function getProPlanCheckoutUrl(userId: string): string | null {
  return initiateCheckout("pro-monthly", userId);
}
