/**
 * Display prices and plan feature rows, dependency-free so the public landing
 * page can show them without pulling the billing/checkout code. pricingConfig
 * re-exports these; pricingConfig.test.ts pins that the plans use the same values.
 */

import type { TKey } from '../i18n/types';

export const FREE_PRICE = '$0';

export const PRO_PRICES = {
  monthly: '$5.99',
  yearly: '$59.99',
  /** 59.99 / 12 ≈ 5.00 — vs $5.99×12 (~$71.88), ~2 months free. */
  yearlyMonthly: '$5.00',
  monthsFree: 2,
} as const;

/** Feature rows per plan, as shown on /pricing and the landing page. */
export const PLAN_FEATURE_KEYS = {
  free: [
    'pay.plan.free.f0',
    'pay.plan.free.f1',
    'pay.plan.free.f2',
    'pay.plan.free.f3',
    'pay.plan.free.f4',
  ],
  proMonthly: [
    'pay.plan.monthly.f0',
    'pay.plan.monthly.f1',
    'pay.plan.monthly.f2',
    'pay.plan.monthly.f3',
    'pay.plan.monthly.f4',
    'pay.plan.monthly.f5',
    'pay.plan.monthly.f6',
    'pay.plan.monthly.f7',
  ],
  proYearly: [
    'pay.plan.yearly.f0',
    'pay.plan.yearly.f1',
    'pay.plan.yearly.f2',
    'pay.plan.yearly.f3',
  ],
} as const satisfies Record<string, readonly TKey[]>;

/** What a free account syncs, and what Pro adds (shown under the plans). */
export const SYNC_SCOPE_KEY: TKey = 'pay.syncScope';
export const SYNC_NOTE_KEY: TKey = 'pay.syncNote';
