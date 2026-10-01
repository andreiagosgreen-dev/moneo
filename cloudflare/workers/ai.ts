/**
 * Server-side AI planner endpoint (Faza 6, arhitectură sigură).
 *
 * The model is called ONLY here, never in the browser: no API key ever
 * reaches the client. JWT identity, server-side Pro check (paid Lemon row
 * or complimentary allowlist; Free → 403 `not_pro`), strict input validation, layered
 * rate limits, minimal context (goal text + two numbers — no sessions,
 * no journal, no habits) and an audit trail without goal text.
 *
 * Without AI_API_KEY the endpoint fails closed with 501: the local
 * on-device planner remains fully usable. Wiring a concrete provider
 * is a config decision, not a code change — add the adapter where
 * marked once a key exists.
 */

import { bearerToken, verifyUser, type FetchImpl } from './account';
import { hasServerProAccess } from './proAccess';
import { computeServerXp, loadServerXpInput } from './discount';
import { AI_DAILY_RANK_BONUS, levelFromXp, rankForLevel, type RankId } from '../../src/lib/xpCore';
import {
  buildSecurityHeaders,
  clientIp,
  createRateLimiter,
  declaredBodyTooLarge,
  mergeHeaders,
} from './security';

export interface AIEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  /** Optional OpenAI-compatible base URL (server-only). */
  AI_BASE_URL?: string;
  PRO_COMPLIMENTARY_EMAILS?: string;
  /** Plans per Pro account per UTC day (cost guard). Default 20. */
  AI_DAILY_LIMIT?: string;
  /** Shared KV; holds the per-account daily counters when bound. */
  KV_CACHE?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  };
}

const DEFAULT_DAILY_LIMIT = 20;

export function dailyLimitOf(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : DEFAULT_DAILY_LIMIT;
}

/**
 * Count one plan for this account today. False once the day's allowance is
 * used. Without KV the per-IP limiter is the only guard (never blocks).
 */
async function takeDailyAllowance(
  env: AIEnv,
  userId: string,
  now: Date,
  bonus = 0,
): Promise<boolean> {
  const kv = env.KV_CACHE;
  if (!kv) return true;
  const key = `ai-quota:${userId}:${now.toISOString().slice(0, 10)}`;
  try {
    const used = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0;
    if (used >= dailyLimitOf(env.AI_DAILY_LIMIT) + Math.max(0, bonus)) return false;
    await kv.put(key, String(used + 1), { expirationTtl: 2 * 86_400 });
    return true;
  } catch {
    return true;
  }
}

/**
 * Pro rank reward: extra plans per day by rank, recomputed from synced data
 * (same rules as the rank discount) and cached in KV for the UTC day. Any
 * failure means no bonus — never a block.
 */
async function rankBonusFor(
  env: AIEnv,
  userId: string,
  createdAt: number | undefined,
  now: Date,
  fetchImpl: FetchImpl,
): Promise<number> {
  const kv = env.KV_CACHE;
  if (!kv || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const key = `ai-rank:${userId}:${now.toISOString().slice(0, 10)}`;
  try {
    const cached = (await kv.get(key)) as RankId | null;
    if (cached && cached in AI_DAILY_RANK_BONUS) return AI_DAILY_RANK_BONUS[cached];
    const from = typeof createdAt === 'number' ? createdAt : 0;
    const input = await loadServerXpInput(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      userId,
      from,
      fetchImpl,
    );
    if (!input) return 0;
    const rank = rankForLevel(levelFromXp(computeServerXp(input, from, now.getTime())).level).id;
    await kv.put(key, rank, { expirationTtl: 86_400 });
    return AI_DAILY_RANK_BONUS[rank];
  } catch {
    return 0;
  }
}

/** Same roadmap prompt as the bring-your-own-key path (src/lib/ai/byok.ts). */
export function planPrompt(v: {
  goal: string;
  horizonMonths: number;
  hoursPerWeek: number;
  level?: string;
  kind?: string;
}): string {
  const hardware = v.kind === 'build' || /drone|dronă|hardware|robot|diy|pcb/i.test(v.goal);
  return [
    'You are a learning/project roadmap assistant for Moneo.',
    'Return ONLY a JSON object with this shape:',
    '{"steps":[{"title":"string","estimateMin":number}]}',
    'Max 12 steps. estimateMin is focused work minutes for that step.',
    'Write the step titles in the same language as the goal.',
    hardware
      ? 'This is a hardware/build goal: include Spec, BOM/parts, assemble, integrate, bench/safety, maiden, iterate. Mention failsafe/safety where relevant.'
      : 'Prefer concrete executable steps over vague advice.',
    `Goal: ${v.goal}`,
    `Horizon months: ${v.horizonMonths}`,
    `Hours per week available: ${v.hoursPerWeek}`,
    v.level ? `Level: ${v.level}` : '',
    v.kind ? `Path kind: ${v.kind}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Model JSON -> at most 12 clean steps (title <=160 chars, 5-600 minutes). */
export function cleanSteps(json: unknown): Array<{ title: string; estimateMin: number }> {
  const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const list = Array.isArray(rec.steps) ? rec.steps : Array.isArray(rec.tasks) ? rec.tasks : [];
  return list
    .map((s) => {
      const r = s && typeof s === 'object' ? (s as Record<string, unknown>) : {};
      const title = typeof r.title === 'string' ? r.title.trim().slice(0, 160) : '';
      const raw =
        typeof r.estimateMin === 'number'
          ? r.estimateMin
          : typeof r.pomodoros === 'number'
            ? r.pomodoros * 25
            : 50;
      return { title, estimateMin: Math.min(600, Math.max(5, Math.round(raw))) };
    })
    .filter((s) => s.title)
    .slice(0, 12);
}

const aiLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const MAX_AI_BODY_BYTES = 65_536;

export interface ValidAIRequest {
  ok: boolean;
  goal?: string;
  horizonMonths?: number;
  hoursPerWeek?: number;
  level?: string;
  kind?: string;
  reason?: string;
}

/** Validate shape + bounds; rejects everything malformed (400, not retryable). */
export function validateAIRequest(body: unknown): ValidAIRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'Invalid payload' };
  }
  const rec = body as Record<string, unknown>;
  const goal = typeof rec.goal === 'string' ? rec.goal.trim() : '';
  if (!goal) return { ok: false, reason: 'Missing goal' };
  if (goal.length > 500) return { ok: false, reason: 'Goal too long' };
  const horizonMonths = typeof rec.horizonMonths === 'number' ? Math.round(rec.horizonMonths) : NaN;
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 480) {
    return { ok: false, reason: 'Bad horizonMonths' };
  }
  const hoursPerWeek = typeof rec.hoursPerWeek === 'number' ? Math.round(rec.hoursPerWeek) : NaN;
  if (!Number.isInteger(hoursPerWeek) || hoursPerWeek < 1 || hoursPerWeek > 40) {
    return { ok: false, reason: 'Bad hoursPerWeek' };
  }
  const level =
    typeof rec.level === 'string' && /^[a-z]{1,20}$/.test(rec.level) ? rec.level : undefined;
  const kind =
    typeof rec.kind === 'string' && /^[a-z]{1,20}$/.test(rec.kind) ? rec.kind : undefined;
  return { ok: true, goal, horizonMonths, hoursPerWeek, level, kind };
}

function api(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(buildSecurityHeaders(), { 'Content-Type': 'application/json' }),
  });
}

export async function handleAIPlan(
  request: Request,
  env: AIEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'POST') return api({ error: 'Method not allowed' }, 405);
  if (!aiLimiter(`ai:${clientIp(request)}`)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: mergeHeaders(buildSecurityHeaders(), {
        'Content-Type': 'application/json',
        'Retry-After': '60',
      }),
    });
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return api({ error: 'AI planner not configured' }, 503);
  }
  const token = bearerToken(request);
  if (!token) return api({ error: 'Missing or invalid authorization' }, 401);
  const user = await verifyUser(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, token, fetchImpl);
  if (!user) return api({ error: 'Invalid or expired session' }, 401);
  const userId = user.userId;

  if (!(await hasServerProAccess(env, userId, user.email, fetchImpl))) {
    return api({ error: 'AI planner is a Pro feature', code: 'not_pro' }, 403);
  }

  if (declaredBodyTooLarge(request, MAX_AI_BODY_BYTES)) {
    return api({ error: 'Payload too large' }, 413);
  }
  const raw = await request.text();
  if (raw.length > MAX_AI_BODY_BYTES) return api({ error: 'Payload too large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return api({ error: 'Invalid JSON' }, 400);
  }
  const valid = validateAIRequest(body);
  if (!valid.ok) return api({ error: valid.reason ?? 'Invalid payload' }, 400);

  // Audit trail: who + params + when. Goal text is deliberately NOT logged.
  console.log(
    JSON.stringify({
      event: 'ai.plan.request',
      user: userId,
      horizonMonths: valid.horizonMonths,
      hoursPerWeek: valid.hoursPerWeek,
      at: new Date().toISOString(),
    }),
  );

  if (!env.AI_API_KEY) {
    return api({ error: 'AI provider not configured', configured: false }, 501);
  }

  const now = new Date();
  const bonus = await rankBonusFor(env, userId, user.createdAt, now, fetchImpl);
  if (!(await takeDailyAllowance(env, userId, now, bonus))) {
    return api({ error: 'Daily AI limit reached', code: 'daily_limit' }, 429);
  }

  const base = (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = env.AI_MODEL || 'gpt-4o-mini';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    const res = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return only valid JSON. No markdown outside JSON.' },
          {
            role: 'user',
            content: planPrompt({
              goal: valid.goal!,
              horizonMonths: valid.horizonMonths!,
              hoursPerWeek: valid.hoursPerWeek!,
              level: valid.level,
              kind: valid.kind,
            }),
          },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return api({ error: 'AI provider error', configured: true }, 502);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawContent = data?.choices?.[0]?.message?.content ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return api({ error: 'AI bad payload', configured: true }, 502);
    }
    const steps = cleanSteps(parsed);
    if (steps.length === 0) return api({ error: 'AI empty plan', configured: true }, 502);
    // The client turns steps into a full path with the same code as the
    // bring-your-own-key planner (phases, milestones, capacity).
    return api({ steps }, 200);
  } catch {
    return api({ error: 'AI provider unreachable', configured: true }, 502);
  }
}
