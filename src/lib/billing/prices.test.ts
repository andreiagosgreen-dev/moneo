import { describe, expect, it } from 'vitest';
import { FREE_PRICE, PLAN_FEATURE_KEYS, PRO_PRICES } from './prices';
import { getPlanDisplay } from './pricingConfig';

describe('prices — shared by /pricing and the landing page', () => {
  it('matches the plans shown on /pricing', () => {
    expect(getPlanDisplay('free')?.price).toBe(FREE_PRICE);
    expect(getPlanDisplay('pro-monthly')?.price).toBe(PRO_PRICES.monthly);
    expect(getPlanDisplay('pro-yearly')?.price).toBe(PRO_PRICES.yearly);
  });

  it('lists the same feature rows as /pricing', () => {
    expect(getPlanDisplay('free')?.featureKeys).toEqual(PLAN_FEATURE_KEYS.free);
    expect(getPlanDisplay('pro-monthly')?.featureKeys).toEqual(PLAN_FEATURE_KEYS.proMonthly);
    expect(getPlanDisplay('pro-yearly')?.featureKeys).toEqual(PLAN_FEATURE_KEYS.proYearly);
  });

  it('keeps the real Lemon Squeezy prices', () => {
    expect(PRO_PRICES.monthly).toBe('$5.99');
    expect(PRO_PRICES.yearly).toBe('$59.99');
  });
});
