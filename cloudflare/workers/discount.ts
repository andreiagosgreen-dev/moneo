/**
 * Rank-based Pro discount (`GET|POST /api/billing/discount`): accounts
 * without Pro get a percentage off the FIRST month of Pro monthly
 * (Apprentice 10%, Practitioner 20%, Expert/Master 30%). Accounts that
 * already have Pro get no offer.
 *
 * The rank is never taken from the client. It is recomputed here with the
 * app's own rules (`src/lib/xpCore.ts`) from what the account has synced to
 * Supabase (focus sessions for every account; finished tasks and habit
 * check-ins from `user_records` when present). Only activity dated between
 * the account's creation and now counts, so back-dated uploads cannot buy a
 * rank; phase/project bonuses are skipped because they carry no date.
 *
 * Each account gets at most one code, ever: the claim is written to
 * KV only after Lemon Squeezy created the single-use code, and a live claim
 * is handed back instead of minting a new one. Without the Lemon API key (or
 * store / variant / KV config) the endpoint answers 503 `not_configured` and
 * the UI hides the offer.
 */

import { bearerToken, isMissingTableResponse, verifyUser, type FetchImpl } from './account';
import { hasComplimentaryPro, resolveComplimentaryAllowlist } from './complimentaryPro';
import { buildSecurityHeaders, mergeHeaders } from './security';
import { hasPaidProAccess } from './subscriptionAccess';
import {
  RANKS,
  focusXp,
  habitXp,
  levelFromXp,
  rankForLevel,
  taskCompletedAt,
  taskXp,
  type RankId,
  type XpHabitLog,
  type XpSessionLike,
  type XpTaskLike,
} from '../../src/lib/xpCore';

/** The subset of a Workers KV namespace this module needs (mockable in tests). */
export interface DiscountKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface DiscountEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LEMON_SQUEEZY_API_KEY?: string;
  LEMON_STORE_ID?: string;
  LEMON_MONTHLY_VARIANT_ID?: string;
  PRO_COMPLIMENTARY_EMAILS?: string;
  KV_CACHE?: DiscountKV;
}

export type DiscountReason = 'too_new' | 'rank_too_low' | 'already_pro' | 'claimed';

const DAY_MS = 86_400_000;
export const MIN_ACCOUNT_AGE_DAYS = 7;
export const CODE_VALID_DAYS = 14;
/** Lowest rank with a discount (Apprentice / Ucenic). */
export const FIRST_DISCOUNT_RANK: RankId = 'apprentice';
export const FIRST_MONTH_PERCENT: Record<RankId, number> = {
  beginner: 0,
  apprentice: 20,
  practitioner: 30,
  expert: 40,
  master: 50,
};
/** A concurrent claim for the same account waits for this lock (KV minimum TTL). */
const LOCK_TTL_S = 60;
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

export function claimKey(userId: string): string {
  return `discount:${userId}`;
}

function lockKey(userId: string): string {
  return `discount-lock:${userId}`;
}

function firstLevelOf(id: RankId): number {
  return RANKS.find((r) => r.id === id)?.firstLevel ?? 1;
}

export function percentFor(rank: RankId): number {
  return FIRST_MONTH_PERCENT[rank];
}

/* ---------- server-side XP ---------- */

export const utcDayKey = (at: number): string => new Date(at).toISOString().slice(0, 10);

export interface ServerXpInput {
  sessions: XpSessionLike[];
  tasks: XpTaskLike[];
  habitLog: XpHabitLog;
}

/** "YYYY-M-D" habit day → UTC midnight ms, or NaN. */
function habitDayMs(day: string): number {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(day);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * XP the server can vouch for: focus + finished tasks + habit check-ins dated
 * inside [from, to]. Day buckets are UTC (the Worker has no user timezone);
 * habit days get one day of slack either side for the same reason.
 */
export function computeServerXp(input: ServerXpInput, from: number, to: number): number {
  const inWindow = (at: number) => Number.isFinite(at) && at >= from && at <= to;
  const sessions = input.sessions.filter((s) => inWindow(s.at));
  const tasks = input.tasks.filter((t) => t.status === 'completed' && inWindow(taskCompletedAt(t)));
  const habitLog: XpHabitLog = {};
  for (const [habitId, days] of Object.entries(input.habitLog)) {
    if (!Array.isArray(days)) continue;
    habitLog[habitId] = days.filter((d) => {
      const ms = typeof d === 'string' ? habitDayMs(d) : NaN;
      return Number.isFinite(ms) && ms >= from - DAY_MS && ms <= to + DAY_MS;
    });
  }
  return focusXp(sessions, utcDayKey) + taskXp(tasks, utcDayKey) + habitXp(habitLog);
}

/* ---------- eligibility (pure) ---------- */

export type ProState = 'none' | 'pro';

export interface DiscountClaim {
  code: string;
  percent: number;
  /** Epoch ms. */
  expiresAt: number;
  discountId: string;
  createdAt: number;
}

export interface DiscountStatus {
  eligible: boolean;
  rank: RankId;
  level: number;
  xp: number;
  percent: number;
  reason?: DiscountReason;
  /** ISO date the account becomes old enough (reason `too_new`). */
  eligibleFrom?: string;
  /** Rank / level / percent to aim for (reason `rank_too_low`). */
  targetRank?: RankId;
  targetLevel?: number;
  targetPercent?: number;
  discountCode?: string;
  /** ISO expiry of the returned code. */
  expiresAt?: string;
}

export interface EligibilityInput {
  now: number;
  accountCreatedAt: number | undefined;
  xp: number;
  pro: ProState;
  claim: DiscountClaim | null;
}

export function evaluateDiscount(input: EligibilityInput): DiscountStatus {
  const { level } = levelFromXp(input.xp);
  const rank = rankForLevel(level).id;
  const base = { rank, level, xp: input.xp };

  if (input.pro === 'pro') {
    return { ...base, eligible: false, percent: 0, reason: 'already_pro' };
  }

  const claim = input.claim;
  if (claim) {
    if (claim.expiresAt > input.now) {
      return {
        ...base,
        eligible: true,
        percent: claim.percent,
        discountCode: claim.code,
        expiresAt: new Date(claim.expiresAt).toISOString(),
      };
    }
    return { ...base, eligible: false, percent: claim.percent, reason: 'claimed' };
  }

  const percent = percentFor(rank);
  const minAge = MIN_ACCOUNT_AGE_DAYS * DAY_MS;
  const created = input.accountCreatedAt;
  if (created === undefined || !Number.isFinite(created) || input.now - created < minAge) {
    return {
      ...base,
      eligible: false,
      percent,
      reason: 'too_new',
      ...(created !== undefined && Number.isFinite(created)
        ? { eligibleFrom: new Date(created + minAge).toISOString() }
        : {}),
    };
  }

  if (percent <= 0) {
    return {
      ...base,
      eligible: false,
      percent: 0,
      reason: 'rank_too_low',
      targetRank: FIRST_DISCOUNT_RANK,
      targetLevel: firstLevelOf(FIRST_DISCOUNT_RANK),
      targetPercent: percentFor(FIRST_DISCOUNT_RANK),
    };
  }

  return { ...base, eligible: true, percent };
}

/* ---------- Lemon Squeezy ---------- */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** `MONEO` + 10 unambiguous uppercase chars (Lemon codes: A–Z / 0–9). */
export function generateDiscountCode(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = 'MONEO';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

export interface CreateDiscountOptions {
  apiKey: string;
  storeId: string;
  variantId: string;
  code: string;
  percent: number;
  expiresAt: number;
  name: string;
}

/** POST /v1/discounts. Returns the Lemon discount id, or null on any failure. */
export async function createLemonDiscount(
  opts: CreateDiscountOptions,
  fetchImpl: FetchImpl = fetch,
): Promise<string | null> {
  try {
    const res = await fetchImpl('https://api.lemonsqueezy.com/v1/discounts', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'discounts',
          attributes: {
            name: opts.name,
            code: opts.code,
            amount: opts.percent,
            amount_type: 'percent',
            is_limited_to_products: true,
            is_limited_redemptions: true,
            max_redemptions: 1,
            expires_at: new Date(opts.expiresAt).toISOString(),
            duration: 'once',
          },
          relationships: {
            store: { data: { type: 'stores', id: opts.storeId } },
            variants: { data: [{ type: 'variants', id: opts.variantId }] },
          },
        },
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { data?: { id?: unknown } };
    const id = payload?.data?.id;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
  } catch {
    return null;
  }
}

/* ---------- Supabase reads (service role) ---------- */

function restHeaders(serviceKey: string): Record<string, string> {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
}

/** Every row of a PostgREST query, paged. Null on failure; `[]` for a missing optional table. */
async function fetchAllRows<T>(
  url: string,
  serviceKey: string,
  fetchImpl: FetchImpl,
  optionalTable = false,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchImpl(`${url}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`, {
      headers: restHeaders(serviceKey),
    });
    if (!res.ok) {
      if (optionalTable && (await isMissingTableResponse(res))) return [];
      return null;
    }
    const batch = (await res.json()) as unknown;
    if (!Array.isArray(batch)) return null;
    rows.push(...(batch as T[]));
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function loadServerXpInput(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  from: number,
  fetchImpl: FetchImpl,
): Promise<ServerXpInput | null> {
  const uid = encodeURIComponent(userId);
  const fromIso = encodeURIComponent(new Date(from).toISOString());
  try {
    const [sessionRows, recordRows] = await Promise.all([
      fetchAllRows<{ completed_at?: unknown; duration_min?: unknown }>(
        `${supabaseUrl}/rest/v1/focus_sessions?user_id=eq.${uid}&completed_at=gte.${fromIso}&select=completed_at,duration_min&order=completed_at.asc`,
        serviceKey,
        fetchImpl,
      ),
      fetchAllRows<{ collection?: unknown; record_id?: unknown; data?: unknown }>(
        `${supabaseUrl}/rest/v1/user_records?user_id=eq.${uid}&collection=in.(tasks,habit_log)&deleted=eq.false&select=collection,record_id,data&order=collection.asc,record_id.asc`,
        serviceKey,
        fetchImpl,
        true,
      ),
    ]);
    if (!sessionRows || !recordRows) return null;

    const sessions: XpSessionLike[] = [];
    for (const r of sessionRows) {
      const at = typeof r.completed_at === 'string' ? Date.parse(r.completed_at) : NaN;
      const min = typeof r.duration_min === 'number' ? r.duration_min : NaN;
      if (Number.isFinite(at) && Number.isFinite(min)) sessions.push({ at, min });
    }
    const tasks: XpTaskLike[] = [];
    const habitLog: XpHabitLog = {};
    for (const r of recordRows) {
      if (r.collection === 'tasks' && r.data && typeof r.data === 'object') {
        const d = r.data as Record<string, unknown>;
        tasks.push({
          status: typeof d.status === 'string' ? d.status : undefined,
          completedAt: typeof d.completedAt === 'number' ? d.completedAt : undefined,
          updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : undefined,
          milestone: d.milestone === true,
        });
      } else if (
        r.collection === 'habit_log' &&
        typeof r.record_id === 'string' &&
        Array.isArray(r.data)
      ) {
        habitLog[r.record_id] = r.data.filter((v): v is string => typeof v === 'string');
      }
    }
    return { sessions, tasks, habitLog };
  } catch {
    return null;
  }
}

async function loadProState(
  env: DiscountEnv & { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string },
  userId: string,
  email: string | null,
  fetchImpl: FetchImpl,
  now: number,
): Promise<ProState | null> {
  if (hasComplimentaryPro(email, resolveComplimentaryAllowlist(env.PRO_COMPLIMENTARY_EMAILS))) {
    return 'pro';
  }
  try {
    const res = await fetchImpl(
      `${env.SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=status,current_period_end&limit=1`,
      { headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY) },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      status?: string;
      current_period_end?: string | null;
    }>;
    const row = Array.isArray(rows) ? rows[0] : undefined;
    return row && hasPaidProAccess(row.status, row.current_period_end, now) ? 'pro' : 'none';
  } catch {
    return null;
  }
}

export function parseClaim(raw: string | null): DiscountClaim | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<DiscountClaim>;
    if (typeof c.code !== 'string' || typeof c.expiresAt !== 'number') return null;
    return {
      code: c.code,
      percent: typeof c.percent === 'number' ? c.percent : 0,
      expiresAt: c.expiresAt,
      discountId: typeof c.discountId === 'string' ? c.discountId : '',
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : 0,
    };
  } catch {
    return null;
  }
}

/* ---------- handler ---------- */

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(buildSecurityHeaders(), {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    }),
  });
}

export interface DiscountDeps {
  fetchImpl?: FetchImpl;
  now?: () => number;
  newCode?: () => string;
}

/**
 * GET → the caller's offer status (never mints a code).
 * POST → mints (or returns the existing) single-use code when eligible.
 */
export async function handleRankDiscount(
  request: Request,
  env: DiscountEnv,
  deps: DiscountDeps = {},
): Promise<Response> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const nowMs = (deps.now ?? Date.now)();
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    LEMON_SQUEEZY_API_KEY,
    LEMON_STORE_ID,
    LEMON_MONTHLY_VARIANT_ID,
    KV_CACHE,
  } = env;
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !LEMON_SQUEEZY_API_KEY ||
    !LEMON_STORE_ID ||
    !LEMON_MONTHLY_VARIANT_ID ||
    !KV_CACHE
  ) {
    return json({ error: 'Discounts are not configured', code: 'not_configured' }, 503);
  }

  const token = bearerToken(request);
  if (!token) return json({ error: 'Missing or invalid authorization' }, 401);
  const user = await verifyUser(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, token, fetchImpl);
  if (!user) return json({ error: 'Invalid or expired session' }, 401);

  const windowFrom = user.createdAt ?? nowMs;
  let claimRaw: string | null;
  try {
    claimRaw = await KV_CACHE.get(claimKey(user.userId));
  } catch {
    return json({ error: 'Could not read discount state', code: 'storage' }, 502);
  }
  const [pro, xpInput] = await Promise.all([
    loadProState(
      { ...env, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY },
      user.userId,
      user.email,
      fetchImpl,
      nowMs,
    ),
    loadServerXpInput(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.userId, windowFrom, fetchImpl),
  ]);
  if (!pro || !xpInput) {
    return json({ error: 'Could not load account data', code: 'storage' }, 502);
  }

  const status = evaluateDiscount({
    now: nowMs,
    accountCreatedAt: user.createdAt,
    xp: computeServerXp(xpInput, windowFrom, nowMs),
    pro,
    claim: parseClaim(claimRaw),
  });

  if (request.method === 'GET') return json(status, 200);
  if (!status.eligible) {
    return json({ ...status, error: 'Not eligible', code: 'not_eligible' }, 403);
  }
  if (status.discountCode) return json(status, 200);

  const lock = lockKey(user.userId);
  try {
    if (await KV_CACHE.get(lock)) {
      return json({ error: 'A code is already being created', code: 'in_progress' }, 409);
    }
    await KV_CACHE.put(lock, '1', { expirationTtl: LOCK_TTL_S });
  } catch {
    return json({ error: 'Could not reserve a code', code: 'storage' }, 502);
  }

  const code = (deps.newCode ?? generateDiscountCode)();
  const expiresAt = nowMs + CODE_VALID_DAYS * DAY_MS;
  const discountId = await createLemonDiscount(
    {
      apiKey: LEMON_SQUEEZY_API_KEY,
      storeId: LEMON_STORE_ID,
      variantId: LEMON_MONTHLY_VARIANT_ID,
      code,
      percent: status.percent,
      expiresAt,
      name: `Moneo ${status.rank} ${status.percent}% first month`,
    },
    fetchImpl,
  );
  if (!discountId) {
    await KV_CACHE.delete(lock).catch(() => undefined);
    return json({ error: 'Could not create a discount code', code: 'lemon_error' }, 502);
  }

  const claim: DiscountClaim = {
    code,
    percent: status.percent,
    expiresAt,
    discountId,
    createdAt: nowMs,
  };
  try {
    await KV_CACHE.put(claimKey(user.userId), JSON.stringify(claim));
  } catch {
    /* the code exists in Lemon; hand it out rather than strand it */
  }
  await KV_CACHE.delete(lock).catch(() => undefined);
  return json({ ...status, discountCode: code, expiresAt: new Date(expiresAt).toISOString() }, 200);
}
