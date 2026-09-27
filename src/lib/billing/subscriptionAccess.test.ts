import { describe, expect, it } from 'vitest';

import { hasPaidProAccess } from './subscriptionAccess';
import {
  accessPeriodEnd,
  hasPaidProAccess as workerHasPaidProAccess,
  normalizeStatus,
  resolvePlanId,
} from '../../../cloudflare/workers/subscriptionAccess';
import { isCancelledButActive, toSubscriptionInfo } from '../cloud/subscriptionRepository';
import { resolveIsPro } from './complimentaryPro';

const NOW = Date.parse('2026-09-27T12:00:00Z');
const FUTURE = '2026-10-25T15:20:41Z';
const PAST = '2026-09-01T00:00:00Z';

describe('hasPaidProAccess — status × period end', () => {
  const matrix: Array<[string | null | undefined, string | null, boolean]> = [
    ['active', FUTURE, true],
    ['active', null, true],
    ['on_trial', FUTURE, true],
    ['past_due', FUTURE, true],
    ['past_due', PAST, true],
    ['cancelled', FUTURE, true],
    ['cancelled', PAST, false],
    ['cancelled', null, false],
    ['cancelled', 'not-a-date', false],
    ['expired', FUTURE, false],
    ['expired', PAST, false],
    ['unpaid', FUTURE, false],
    ['paused', FUTURE, false],
    ['free', null, false],
    [null, null, false],
    [undefined, FUTURE, false],
  ];

  it.each(matrix)('%s until %s → %s', (status, end, expected) => {
    expect(hasPaidProAccess(status, end, NOW)).toBe(expected);
  });

  it('client and worker predicates agree on every row', () => {
    for (const [status, end] of matrix) {
      expect(workerHasPaidProAccess(status, end, NOW)).toBe(hasPaidProAccess(status, end, NOW));
      const ms = end ? Date.parse(end) : null;
      expect(workerHasPaidProAccess(status, ms, NOW)).toBe(hasPaidProAccess(status, ms, NOW));
    }
  });

  it('cancelled access ends exactly at ends_at', () => {
    const end = Date.parse(FUTURE);
    expect(hasPaidProAccess('cancelled', end, end - 1)).toBe(true);
    expect(hasPaidProAccess('cancelled', end, end)).toBe(false);
  });
});

describe('toSubscriptionInfo', () => {
  it('keeps Pro for a cancelled subscription until its end date', () => {
    const sub = toSubscriptionInfo(
      { status: 'cancelled', plan_id: 'pro-yearly', current_period_end: FUTURE },
      NOW,
    );
    expect(sub.isPro).toBe(true);
    expect(sub.planId).toBe('pro-yearly');
    expect(isCancelledButActive(sub)).toBe(true);
  });

  it('drops Pro once the cancelled period is over', () => {
    const sub = toSubscriptionInfo(
      { status: 'cancelled', plan_id: 'pro-monthly', current_period_end: PAST },
      NOW,
    );
    expect(sub.isPro).toBe(false);
    expect(isCancelledButActive(sub)).toBe(false);
  });

  it('treats a missing row status as free', () => {
    const sub = toSubscriptionInfo({ status: null, plan_id: null, current_period_end: null }, NOW);
    expect(sub).toEqual({ status: 'free', planId: 'free', currentPeriodEnd: null, isPro: false });
  });

  it('complimentary allowlist still unlocks Pro on top of an expired row', () => {
    const sub = toSubscriptionInfo(
      { status: 'expired', plan_id: 'pro-monthly', current_period_end: PAST },
      NOW,
    );
    expect(resolveIsPro(sub.isPro, 'vip@example.com', ['vip@example.com'])).toBe(true);
    expect(resolveIsPro(sub.isPro, 'other@example.com', ['vip@example.com'])).toBe(false);
  });
});

describe('resolvePlanId (webhook)', () => {
  const ids = { yearlyIds: '2156050,1380216', monthlyIds: '2156059,1380224' };

  it('maps configured Lemon variant / product ids', () => {
    expect(resolvePlanId({ variant_id: 2156050, variant_name: 'Default' }, ids)).toBe('pro-yearly');
    expect(resolvePlanId({ product_id: 1380216 }, ids)).toBe('pro-yearly');
    expect(resolvePlanId({ variant_id: 2156059 }, ids)).toBe('pro-monthly');
    expect(resolvePlanId({ variant_id: '2156059' }, ids)).toBe('pro-monthly');
  });

  it('ids win over misleading names', () => {
    expect(resolvePlanId({ variant_id: 2156059, product_name: 'Moneo Pro (Yearly)' }, ids)).toBe(
      'pro-monthly',
    );
  });

  it('falls back to product name when the variant is "Default"', () => {
    const attrs = { variant_id: 1, variant_name: 'Default', product_name: 'Moneo Pro (Yearly)' };
    expect(resolvePlanId(attrs)).toBe('pro-yearly');
    expect(resolvePlanId({ ...attrs, product_name: 'Moneo Pro (Monthly)' })).toBe('pro-monthly');
  });

  it('recognises yearly wording in variant names and other languages', () => {
    expect(resolvePlanId({ variant_name: 'Yearly' })).toBe('pro-yearly');
    expect(resolvePlanId({ variant_name: 'Annual plan' })).toBe('pro-yearly');
    expect(resolvePlanId({ product_name: 'Moneo Pro Anual' })).toBe('pro-yearly');
    expect(resolvePlanId({ variant_name: '12-month' })).toBe('pro-yearly');
  });

  it('defaults to monthly when nothing identifies the interval', () => {
    expect(resolvePlanId({})).toBe('pro-monthly');
    expect(resolvePlanId({ variant_name: 'Default', product_name: 'Moneo Pro' })).toBe(
      'pro-monthly',
    );
  });
});

describe('normalizeStatus / accessPeriodEnd (webhook)', () => {
  it('stores on_trial as active and fails closed on unknown values', () => {
    expect(normalizeStatus('on_trial')).toBe('active');
    for (const s of ['active', 'past_due', 'cancelled', 'expired', 'paused', 'unpaid']) {
      expect(normalizeStatus(s)).toBe(s);
    }
    expect(normalizeStatus('something_new')).toBe('expired');
    expect(normalizeStatus(undefined)).toBe('expired');
  });

  it('uses ends_at for cancelled / expired subscriptions', () => {
    expect(accessPeriodEnd({ status: 'cancelled', renews_at: PAST, ends_at: FUTURE })).toBe(FUTURE);
    expect(accessPeriodEnd({ status: 'expired', renews_at: FUTURE, ends_at: PAST })).toBe(PAST);
    expect(accessPeriodEnd({ status: 'cancelled', renews_at: FUTURE, ends_at: null })).toBe(FUTURE);
  });

  it('uses renews_at for renewing subscriptions', () => {
    expect(accessPeriodEnd({ status: 'active', renews_at: FUTURE, ends_at: null })).toBe(FUTURE);
    expect(accessPeriodEnd({ status: 'past_due', renews_at: FUTURE })).toBe(FUTURE);
    expect(accessPeriodEnd({ status: 'active' })).toBeNull();
  });
});
