/**
 * Client for the Worker's rank discount (`/api/billing/discount`).
 * The browser only presents its Supabase token; the rank is recomputed on
 * the server and the Lemon Squeezy API key never leaves the Worker. Any
 * failure (not configured, signed out, offline) resolves to null, and the
 * UI shows nothing.
 */

import type { RankId } from '../xpCore';

export type DiscountOffer = 'first_month' | 'yearly_switch';

export type DiscountReason =
  'too_new' | 'rank_too_low' | 'already_pro' | 'already_yearly' | 'claimed';

export interface RankDiscountStatus {
  eligible: boolean;
  offer: DiscountOffer | null;
  rank: RankId;
  level: number;
  percent: number;
  plan: 'pro-monthly' | 'pro-yearly' | null;
  reason?: DiscountReason;
  targetRank?: RankId;
  targetLevel?: number;
  targetPercent?: number;
  discountCode?: string;
  expiresAt?: string;
}

/** Mirrors `MIN_ACCOUNT_AGE_DAYS` / `CODE_VALID_DAYS` in the Worker. */
export const DISCOUNT_MIN_ACCOUNT_DAYS = 7;
export const DISCOUNT_CODE_VALID_DAYS = 14;

const RANK_IDS: ReadonlySet<string> = new Set([
  'beginner',
  'apprentice',
  'practitioner',
  'expert',
  'master',
]);

export function parseDiscountStatus(body: unknown): RankDiscountStatus | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.eligible !== 'boolean' || typeof b.rank !== 'string' || !RANK_IDS.has(b.rank)) {
    return null;
  }
  const offer = b.offer === 'first_month' || b.offer === 'yearly_switch' ? b.offer : null;
  const plan = b.plan === 'pro-monthly' || b.plan === 'pro-yearly' ? b.plan : null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const code =
    typeof b.discountCode === 'string' && /^[A-Z0-9]{3,64}$/.test(b.discountCode)
      ? b.discountCode
      : undefined;
  return {
    eligible: b.eligible && offer !== null && plan !== null,
    offer,
    rank: b.rank as RankId,
    level: num(b.level) ?? 1,
    percent: num(b.percent) ?? 0,
    plan,
    reason: typeof b.reason === 'string' ? (b.reason as DiscountReason) : undefined,
    targetRank:
      typeof b.targetRank === 'string' && RANK_IDS.has(b.targetRank)
        ? (b.targetRank as RankId)
        : undefined,
    targetLevel: num(b.targetLevel),
    targetPercent: num(b.targetPercent),
    discountCode: code,
    expiresAt: typeof b.expiresAt === 'string' ? b.expiresAt : undefined,
  };
}

/**
 * GET reads the offer; POST mints (or returns) the caller's code. A 403 on
 * POST still carries a status body (not eligible), so it is parsed too.
 */
export async function requestRankDiscount(
  method: 'GET' | 'POST',
  getAccessToken: () => Promise<string | null>,
  fetchFn: typeof fetch = fetch,
): Promise<RankDiscountStatus | null> {
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const res = await fetchFn('/api/billing/discount', {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 403) return null;
    return parseDiscountStatus(await res.json());
  } catch {
    return null;
  }
}
