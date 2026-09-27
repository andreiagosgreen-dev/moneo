/**
 * Lemon Squeezy subscription → Moneo plan + Pro access (worker side).
 *
 * Mirrors `src/lib/billing/subscriptionAccess.ts` (keep `hasPaidProAccess`
 * in sync — `subscriptionAccess.test.ts` asserts both agree).
 *
 * Status semantics (docs.lemonsqueezy.com/api/subscriptions/the-subscription-object):
 * - on_trial / active: access.
 * - past_due: renewal failed, Lemon retries for ~2 weeks → keep access.
 * - cancelled: no future charges but still valid until `ends_at` → access
 *   until that date, then Free (even if `subscription_expired` is late).
 * - unpaid / paused / expired: no access.
 */

export type PlanId = 'pro-monthly' | 'pro-yearly';

/** Statuses the `subscriptions_status_check` constraint accepts (0006). */
const STORED_STATUSES: ReadonlySet<string> = new Set([
  'active',
  'past_due',
  'cancelled',
  'expired',
  'paused',
  'unpaid',
]);

export function hasPaidProAccess(
  status: string | null | undefined,
  periodEnd: string | number | null | undefined,
  now: number = Date.now(),
): boolean {
  if (status === 'active' || status === 'on_trial' || status === 'past_due') return true;
  if (status !== 'cancelled' || periodEnd == null) return false;
  const end = typeof periodEnd === 'number' ? periodEnd : Date.parse(periodEnd);
  return Number.isFinite(end) && end > now;
}

export interface LemonSubscriptionAttributes {
  customer_id?: unknown;
  status?: unknown;
  variant_id?: unknown;
  product_id?: unknown;
  variant_name?: unknown;
  product_name?: unknown;
  renews_at?: unknown;
  ends_at?: unknown;
}

export interface PlanIdConfig {
  /** Comma-separated Lemon variant or product ids billed yearly. */
  yearlyIds?: string;
  /** Comma-separated Lemon variant or product ids billed monthly. */
  monthlyIds?: string;
}

function idSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

const YEARLY_NAME = /year|annual|anual|annuel|jahr|12[\s-]?month/i;
const MONTHLY_NAME = /month|lunar|mensu|monat/i;

/**
 * Plan from the Lemon payload. Store products are separate per interval
 * (variant_name is "Default", product_name carries "(Yearly)"), so check
 * configured ids first, then both names; unknown → monthly.
 */
export function resolvePlanId(
  attrs: LemonSubscriptionAttributes,
  config: PlanIdConfig = {},
): PlanId {
  const ids = [attrs.variant_id, attrs.product_id]
    .filter((v) => typeof v === 'number' || typeof v === 'string')
    .map(String);
  const yearly = idSet(config.yearlyIds);
  const monthly = idSet(config.monthlyIds);
  if (ids.some((id) => yearly.has(id))) return 'pro-yearly';
  if (ids.some((id) => monthly.has(id))) return 'pro-monthly';

  const names = [attrs.variant_name, attrs.product_name]
    .filter((v): v is string => typeof v === 'string')
    .join(' ');
  if (YEARLY_NAME.test(names)) return 'pro-yearly';
  if (MONTHLY_NAME.test(names)) return 'pro-monthly';
  return 'pro-monthly';
}

/**
 * Lemon status → value allowed by the DB constraint. on_trial is stored as
 * active; anything unrecognised fails closed (no access).
 */
export function normalizeStatus(status: unknown): string {
  if (status === 'on_trial') return 'active';
  return typeof status === 'string' && STORED_STATUSES.has(status) ? status : 'expired';
}

function isoOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * `current_period_end` = when access (or the current cycle) ends. For a
 * cancelled/expired subscription that is `ends_at`; otherwise `renews_at`.
 */
export function accessPeriodEnd(attrs: LemonSubscriptionAttributes): string | null {
  const status = normalizeStatus(attrs.status);
  const renewsAt = isoOrNull(attrs.renews_at);
  const endsAt = isoOrNull(attrs.ends_at);
  if (status === 'cancelled' || status === 'expired') return endsAt ?? renewsAt;
  return renewsAt ?? endsAt;
}
