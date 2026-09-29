import { describe, expect, it } from 'vitest';
import {
  FREE_PRICE,
  PLAN_FEATURE_KEYS,
  PRO_PRICES,
  formatUsd,
  parseUsd,
  yearlySavings,
} from './prices';
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

  it('computes the real yearly savings, floored', () => {
    expect(yearlySavings()).toEqual({
      monthlyTimes12: 71.88,
      yearly: 59.99,
      saved: 11.89,
      pct: 16,
    });
    expect(formatUsd(11.89)).toBe('$11.89');
    expect(formatUsd(5)).toBe('$5.00');
    expect(parseUsd('junk')).toBe(0);
    expect(yearlySavings({ monthly: '$5', yearly: '$80' })).toMatchObject({ saved: 0, pct: 0 });
  });
});
