import { describe, expect, it } from 'vitest';
import {
  SIGNUP_TRIAL_DAYS,
  inSignupTrial,
  signupTrialDaysLeft,
  signupTrialEndsAt,
  trialNotice,
} from './signupTrial';
import { currentPlanOf } from './entitlements';
import { hasServerProAccess } from '../../../cloudflare/workers/proAccess';
import type { FetchImpl } from '../../../cloudflare/workers/account';

const DAY = 86_400_000;
const CREATED = Date.UTC(2026, 9, 1, 10);

describe('sign-up trial', () => {
  it('runs exactly 7 days from account creation', () => {
    expect(SIGNUP_TRIAL_DAYS).toBe(7);
    expect(signupTrialEndsAt(CREATED)).toBe(CREATED + 7 * DAY);
    expect(inSignupTrial(CREATED, CREATED)).toBe(true);
    expect(inSignupTrial(CREATED, CREATED + 7 * DAY - 1)).toBe(true);
    expect(inSignupTrial(CREATED, CREATED + 7 * DAY)).toBe(false);
    expect(inSignupTrial(undefined, CREATED)).toBe(false);
    expect(inSignupTrial(null)).toBe(false);
  });

  it('counts days left, rounding up', () => {
    expect(signupTrialDaysLeft(CREATED, CREATED)).toBe(7);
    expect(signupTrialDaysLeft(CREATED, CREATED + 6.5 * DAY)).toBe(1);
    expect(signupTrialDaysLeft(CREATED, CREATED + 8 * DAY)).toBe(0);
  });

  it('notifies in the last 3 days and for 3 days after the end', () => {
    expect(trialNotice(CREATED, true, CREATED + DAY)).toBeNull();
    expect(trialNotice(CREATED, true, CREATED + 5 * DAY)).toEqual({ kind: 'left', days: 2 });
    expect(trialNotice(CREATED, false, CREATED + 8 * DAY)).toEqual({ kind: 'ended' });
    expect(trialNotice(CREATED, true, CREATED + 8 * DAY)).toBeNull();
    expect(trialNotice(CREATED, false, CREATED + 11 * DAY)).toBeNull();
    expect(trialNotice(undefined, false)).toBeNull();
  });

  it('labels the plan as a trial unless it is paid', () => {
    expect(currentPlanOf(true, { planId: 'free', isPro: false }, true)).toBe('pro-trial');
    expect(currentPlanOf(true, { planId: 'free', isPro: false }, false)).toBe('pro-gift');
    expect(currentPlanOf(true, { planId: 'pro-yearly', isPro: true }, true)).toBe('pro-yearly');
    expect(currentPlanOf(false, { planId: 'free', isPro: false }, false)).toBe('free');
  });
});

describe('server Pro check with the trial', () => {
  const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
  const noSub = (async () =>
    new Response(JSON.stringify([]), { status: 200 })) as unknown as FetchImpl;

  it('grants Pro to a new account and not to an old one without a subscription', async () => {
    const now = Date.now();
    expect(await hasServerProAccess(env, 'u', null, noSub, now - 2 * DAY)).toBe(true);
    expect(await hasServerProAccess(env, 'u', null, noSub, now - 8 * DAY)).toBe(false);
    expect(await hasServerProAccess(env, 'u', null, noSub)).toBe(false);
  });
});
