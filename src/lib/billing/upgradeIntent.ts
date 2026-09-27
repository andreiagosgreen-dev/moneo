/**
 * Upgrade intent that survives the sign-in detour: a logged-out visitor
 * who picks a paid plan goes to /login?upgrade=<plan> and comes back to
 * /pricing?upgrade=<plan> once a session lands (form or OAuth round-trip).
 * Only the two paid plan ids are accepted — never a free-form redirect.
 */

export type PaidPlanId = 'pro-monthly' | 'pro-yearly';

export const UPGRADE_PARAM = 'upgrade';

export function parsePaidPlan(value: string | null | undefined): PaidPlanId | null {
  return value === 'pro-monthly' || value === 'pro-yearly' ? value : null;
}

export function loginPathForUpgrade(plan: PaidPlanId): string {
  return `/login?${UPGRADE_PARAM}=${plan}`;
}

export function pricingPathForUpgrade(plan: PaidPlanId): string {
  return `/pricing?${UPGRADE_PARAM}=${plan}`;
}
