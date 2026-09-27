/**
 * Paid Pro access from the stored Lemon subscription row.
 *
 * Mirrors `hasPaidProAccess` in `cloudflare/workers/subscriptionAccess.ts`
 * (Calendar + Focus Buddy gate on the Worker) — keep both in sync.
 * Complimentary Pro is layered on top by `resolveIsPro`.
 *
 * active / on_trial / past_due (Lemon retries ~2 weeks) → Pro.
 * cancelled → Pro until `current_period_end` (Lemon `ends_at`), then Free.
 * unpaid / paused / expired / free → no access.
 */
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
