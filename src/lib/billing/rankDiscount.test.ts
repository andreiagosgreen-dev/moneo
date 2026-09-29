import { afterEach, describe, expect, it, vi } from 'vitest';
import { CODE_VALID_DAYS, MIN_ACCOUNT_AGE_DAYS } from '../../../cloudflare/workers/discount';
import { buildCheckoutUrl } from './lemonSqueezy';
import {
  DISCOUNT_CODE_VALID_DAYS,
  DISCOUNT_MIN_ACCOUNT_DAYS,
  parseDiscountStatus,
  requestRankDiscount,
} from './rankDiscount';

const BASE = 'https://moneo.lemonsqueezy.com/checkout';

afterEach(() => {
  vi.unstubAllEnvs();
});

const token = async () => 'tok';

function respond(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as unknown as typeof fetch;
}

describe('rank discount client', () => {
  it('mirrors the Worker constants', () => {
    expect(DISCOUNT_CODE_VALID_DAYS).toBe(CODE_VALID_DAYS);
    expect(DISCOUNT_MIN_ACCOUNT_DAYS).toBe(MIN_ACCOUNT_AGE_DAYS);
  });

  it('parses an eligible status with a code', () => {
    expect(
      parseDiscountStatus({
        eligible: true,
        offer: 'first_month',
        rank: 'practitioner',
        level: 10,
        percent: 20,
        plan: 'pro-monthly',
        discountCode: 'MONEOABC123',
        expiresAt: '2026-10-13T12:00:00.000Z',
      }),
    ).toMatchObject({ eligible: true, percent: 20, discountCode: 'MONEOABC123' });
  });

  it('rejects junk and drops malformed codes', () => {
    expect(parseDiscountStatus(null)).toBeNull();
    expect(parseDiscountStatus({ eligible: true, rank: 'god' })).toBeNull();
    const s = parseDiscountStatus({
      eligible: true,
      offer: 'first_month',
      rank: 'expert',
      plan: 'pro-monthly',
      discountCode: 'bad code&x=1',
    });
    expect(s?.discountCode).toBeUndefined();
    expect(
      parseDiscountStatus({ eligible: true, offer: null, rank: 'expert', plan: null })?.eligible,
    ).toBe(false);
  });

  it('hides the offer when the Worker is not configured or the user is signed out', async () => {
    expect(
      await requestRankDiscount('GET', token, respond(503, { code: 'not_configured' })),
    ).toBeNull();
    expect(await requestRankDiscount('GET', async () => null, respond(200, {}))).toBeNull();
  });

  it('reads the not-eligible body of a 403', async () => {
    const s = await requestRankDiscount(
      'POST',
      token,
      respond(403, {
        eligible: false,
        offer: 'first_month',
        rank: 'beginner',
        plan: 'pro-monthly',
        reason: 'rank_too_low',
        code: 'not_eligible',
      }),
    );
    expect(s).toMatchObject({ eligible: false, reason: 'rank_too_low' });
  });

  it('sends the bearer token and method', async () => {
    const f = respond(200, { eligible: false, rank: 'beginner', offer: null, plan: null });
    await requestRankDiscount('POST', token, f);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/billing/discount');
    expect(init).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer tok' } });
  });
});

describe('buildCheckoutUrl with a discount code', () => {
  function configure() {
    vi.stubEnv('VITE_LEMONSQUEEZY_STORE_ID', 's1');
    vi.stubEnv('VITE_LEMONSQUEEZY_CHECKOUT_URL', BASE);
    vi.stubEnv('VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID', '111');
    vi.stubEnv('VITE_LEMONSQUEEZY_YEARLY_VARIANT_ID', '222');
  }

  it('prefills a valid code', () => {
    configure();
    expect(buildCheckoutUrl('pro-monthly', 'u1', 'MONEOABC123')).toBe(
      `${BASE}/buy/111?checkout[custom][user_id]=u1&checkout[discount_code]=MONEOABC123`,
    );
  });

  it('ignores anything that is not a plain uppercase code', () => {
    configure();
    expect(buildCheckoutUrl('pro-yearly', 'u1', 'x&checkout[custom][user_id]=evil')).toBe(
      `${BASE}/buy/222?checkout[custom][user_id]=u1`,
    );
  });
});
