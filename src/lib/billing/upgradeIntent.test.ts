import { describe, expect, it } from 'vitest';

import { loginPathForUpgrade, parsePaidPlan, pricingPathForUpgrade } from './upgradeIntent';

describe('upgrade intent', () => {
  it('accepts only the two paid plan ids', () => {
    expect(parsePaidPlan('pro-monthly')).toBe('pro-monthly');
    expect(parsePaidPlan('pro-yearly')).toBe('pro-yearly');
    expect(parsePaidPlan('free')).toBeNull();
    expect(parsePaidPlan('//evil.test')).toBeNull();
    expect(parsePaidPlan(null)).toBeNull();
    expect(parsePaidPlan(undefined)).toBeNull();
  });

  it('round-trips the plan through /login back to /pricing', () => {
    expect(loginPathForUpgrade('pro-yearly')).toBe('/login?upgrade=pro-yearly');
    expect(pricingPathForUpgrade('pro-monthly')).toBe('/pricing?upgrade=pro-monthly');
    const back = new URL(`https://moneo.bond${loginPathForUpgrade('pro-yearly')}`);
    expect(parsePaidPlan(back.searchParams.get('upgrade'))).toBe('pro-yearly');
  });
});
