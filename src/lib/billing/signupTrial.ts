/**
 * Free Pro trial from sign-up: every new account is Pro for the first
 * SIGNUP_TRIAL_DAYS days after its creation, without a card. Afterwards it is
 * Free unless the user subscribes; nothing is ever charged automatically.
 *
 * Shared by the app (UI gating) and the Worker (server-side Pro checks), so
 * both count from the same Supabase `created_at`.
 */

export const SIGNUP_TRIAL_DAYS = 7;
const DAY_MS = 86_400_000;

/** When the sign-up trial ends (epoch ms), or null without a creation time. */
export function signupTrialEndsAt(
  createdAt: number | null | undefined,
  days: number = SIGNUP_TRIAL_DAYS,
): number | null {
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || days <= 0) return null;
  return createdAt + days * DAY_MS;
}

export function inSignupTrial(
  createdAt: number | null | undefined,
  now: number = Date.now(),
  days: number = SIGNUP_TRIAL_DAYS,
): boolean {
  const end = signupTrialEndsAt(createdAt, days);
  // A creation time in the future (clock skew) still counts as the first day.
  return end !== null && now < end;
}

/** Whole days left, rounded up (1 on the last day); 0 once it ended. */
export function signupTrialDaysLeft(
  createdAt: number | null | undefined,
  now: number = Date.now(),
  days: number = SIGNUP_TRIAL_DAYS,
): number {
  const end = signupTrialEndsAt(createdAt, days);
  if (end === null || now >= end) return 0;
  return Math.min(days, Math.ceil((end - now) / DAY_MS));
}

/** Days around the trial's end when Today shows a note. */
export const TRIAL_NOTICE_DAYS = 3;

export type TrialNotice = { kind: 'left'; days: number } | { kind: 'ended' } | null;

/**
 * What Today says about the trial: the last few days left, or that it just
 * ended (for a few days, unless the account is Pro some other way).
 */
export function trialNotice(
  createdAt: number | null | undefined,
  isPro: boolean,
  now: number = Date.now(),
): TrialNotice {
  const end = signupTrialEndsAt(createdAt);
  if (end === null) return null;
  if (now < end) {
    const days = signupTrialDaysLeft(createdAt, now);
    return days <= TRIAL_NOTICE_DAYS ? { kind: 'left', days } : null;
  }
  return !isPro && now < end + TRIAL_NOTICE_DAYS * DAY_MS ? { kind: 'ended' } : null;
}
