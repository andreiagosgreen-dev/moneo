/**
 * Display prices, dependency-free so the public landing page can show them
 * without pulling the billing/checkout code. pricingConfig re-exports these;
 * pricingConfig.test.ts pins that the plans use the same values.
 */

export const FREE_PRICE = '$0';

export const PRO_PRICES = {
  monthly: '$5.99',
  yearly: '$59.99',
  /** 59.99 / 12 ≈ 5.00 — vs $5.99×12 (~$71.88), ~2 months free. */
  yearlyMonthly: '$5.00',
  monthsFree: 2,
} as const;
