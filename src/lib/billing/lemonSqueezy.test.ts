import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildCheckoutUrl,
  buildCustomerPortalUrl,
  getLemonSqueezyConfig,
  getPricingPlans,
  initiateCheckout,
} from './lemonSqueezy';

const BASE = 'https://moneo.lemonsqueezy.com/checkout';

function configureEnv(vars: Record<string, string>) {
  vi.stubEnv('VITE_LEMONSQUEEZY_STORE_ID', vars.store ?? '');
  vi.stubEnv('VITE_LEMONSQUEEZY_CHECKOUT_URL', vars.base ?? '');
  vi.stubEnv('VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID', vars.monthly ?? '');
  vi.stubEnv('VITE_LEMONSQUEEZY_YEARLY_VARIANT_ID', vars.yearly ?? '');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getLemonSqueezyConfig', () => {
  it('reads store, base URL and per-plan variant ids', () => {
    configureEnv({ store: 's1', base: BASE, monthly: '111', yearly: '222' });
    expect(getLemonSqueezyConfig()).toEqual({
      storeId: 's1',
      checkoutUrl: BASE,
      monthlyVariantId: '111',
      yearlyVariantId: '222',
    });
  });

  it('normalizes missing values to null', () => {
    configureEnv({});
    expect(getLemonSqueezyConfig()).toEqual({
      storeId: null,
      checkoutUrl: null,
      monthlyVariantId: null,
      yearlyVariantId: null,
    });
  });
});

describe('buildCheckoutUrl', () => {
  it('opens distinct variants for monthly vs yearly', () => {
    configureEnv({ store: 's1', base: BASE, monthly: '111', yearly: '222' });
    expect(buildCheckoutUrl('pro-monthly', 'user-1')).toBe(
      `${BASE}/buy/111?checkout[custom][user_id]=user-1`,
    );
    expect(buildCheckoutUrl('pro-yearly', 'user-1')).toBe(
      `${BASE}/buy/222?checkout[custom][user_id]=user-1`,
    );
  });

  it('URL-encodes the user id for webhook attribution', () => {
    configureEnv({ store: 's1', base: BASE, monthly: '111', yearly: '222' });
    expect(buildCheckoutUrl('pro-monthly', 'a b&c@d')).toBe(
      `${BASE}/buy/111?checkout[custom][user_id]=${encodeURIComponent('a b&c@d')}`,
    );
  });

  it('falls back to the base checkout when a variant id is missing', () => {
    configureEnv({ store: 's1', base: BASE });
    expect(buildCheckoutUrl('pro-monthly', 'user-1')).toBe(
      `${BASE}?checkout[custom][user_id]=user-1`,
    );
  });

  it('returns null for free or unconfigured billing', () => {
    configureEnv({ store: 's1', base: BASE, monthly: '111', yearly: '222' });
    expect(buildCheckoutUrl('free', 'user-1')).toBeNull();
    configureEnv({});
    expect(buildCheckoutUrl('pro-monthly', 'user-1')).toBeNull();
    expect(initiateCheckout('pro-yearly', 'user-1')).toBeNull();
  });

  it('initiateCheckout delegates per plan', () => {
    configureEnv({ store: 's1', base: BASE, monthly: '111', yearly: '222' });
    expect(initiateCheckout('pro-yearly', 'user-1')).toContain('/buy/222');
  });

  it('fails closed on non-https or unparsable checkout base (Faza 5A)', () => {
    configureEnv({ store: 's1', base: 'http://evil.test/checkout', monthly: '111', yearly: '222' });
    expect(buildCheckoutUrl('pro-monthly', 'user-1')).toBeNull();
    configureEnv({ store: 's1', base: 'javascript:alert(1)', monthly: '111', yearly: '222' });
    expect(buildCheckoutUrl('pro-monthly', 'user-1')).toBeNull();
    configureEnv({ store: 's1', base: 'not a url', monthly: '111', yearly: '222' });
    expect(buildCheckoutUrl('pro-monthly', 'user-1')).toBeNull();
  });
});

describe('buildCustomerPortalUrl', () => {
  it('derives the /billing path from the store domain', () => {
    configureEnv({ store: 's1', base: BASE });
    expect(buildCustomerPortalUrl()).toBe('https://moneo.lemonsqueezy.com/billing');
  });

  it('returns null when unconfigured or the base is unsafe', () => {
    configureEnv({});
    expect(buildCustomerPortalUrl()).toBeNull();
    configureEnv({ store: 's1', base: 'http://evil.test/checkout' });
    expect(buildCustomerPortalUrl()).toBeNull();
    configureEnv({ store: 's1', base: 'not a url' });
    expect(buildCustomerPortalUrl()).toBeNull();
  });
});

describe('getPricingPlans', () => {
  it('lists all three plans without checkout placeholders', () => {
    const plans = getPricingPlans();
    expect(plans.map((p) => p.id)).toEqual(['free', 'pro-monthly', 'pro-yearly']);
    expect(plans.every((p) => !('checkoutUrl' in p))).toBe(true);
  });
});
