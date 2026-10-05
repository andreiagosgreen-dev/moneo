/**
 * Server-side AI planner endpoint (Faza 6, arhitectură sigură).
 *
 * The model is called ONLY here, never in the browser: no API key ever
 * reaches the client. JWT identity, server-side Pro check (paid Lemon row
 * or complimentary allowlist; Free → 403 `not_pro`), strict input validation, layered
 * rate limits, minimal context (goal text + two numbers — no sessions,
 * no journal, no habits) and an audit trail without goal text.
 *
 * Provider: Cloudflare Workers AI through the `AI` binding (free daily
 * allocation, no key), or an OpenAI-compatible API when AI_API_KEY is set.
 * Neither → 501 and the on-device planner stays fully usable. A per-account
 * daily allowance and a global daily cap keep usage inside the free tier;
 * when either is used up the client quietly builds the plan on the device.
 */

import { bearerToken, verifyUser, type FetchImpl } from './account';
import { hasServerProAccess } from './proAccess';
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
  /** Plans for all accounts together per UTC day (keeps Workers AI free). */
  AI_GLOBAL_DAILY_CAP?: string;
  /** Cloudflare Workers AI binding (wrangler.toml `[ai]`). */
  AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
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
export async function takeDailyAllowance(
  env: AIEnv,
  userId: string,
  now: Date,
  prefix = 'ai-quota',
): Promise<boolean> {
  const kv = env.KV_CACHE;
  if (!kv) return true;
  const key = `${prefix}:${userId}:${now.toISOString().slice(0, 10)}`;
  try {
    const used = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0;
    if (used >= dailyLimitOf(env.AI_DAILY_LIMIT)) return false;
    await kv.put(key, String(used + 1), { expirationTtl: 2 * 86_400 });
    return true;
  } catch {
    return true;
  }
}

const DEFAULT_GLOBAL_CAP = 150;

export function globalCapOf(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100_000) : DEFAULT_GLOBAL_CAP;
}

/**
 * All accounts together: once the day's cap is reached, plans are built on
 * the device until the next UTC day. Best effort (KV is eventually
 * consistent); without KV there is no global cap.
 */
export async function takeGlobalAllowance(env: AIEnv, now: Date): Promise<boolean> {
  const kv = env.KV_CACHE;
  if (!kv) return true;
  const key = `ai-global:${now.toISOString().slice(0, 10)}`;
  try {
    const used = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0;
    if (used >= globalCapOf(env.AI_GLOBAL_DAILY_CAP)) return false;
    await kv.put(key, String(used + 1), { expirationTtl: 2 * 86_400 });
    return true;
  } catch {
    return true;
  }
}

export const WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';

/** Workers AI answers `{ response: string | object }`; pull the JSON plan out. */
export function workersAiJson(result: unknown): unknown {
  const response = (result as { response?: unknown } | null)?.response;
  if (response && typeof response === 'object') return response;
  if (typeof response !== 'string') return null;
  const start = response.indexOf('{');
  const end = response.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(response.slice(start, end + 1));
  } catch {
    return null;
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

  if (!env.AI_API_KEY && !env.AI) {
    return api({ error: 'AI provider not configured', configured: false }, 501);
  }

  const now = new Date();
  if (!(await takeDailyAllowance(env, userId, now))) {
    return api({ error: 'Daily AI limit reached', code: 'daily_limit' }, 429);
  }
  if (!(await takeGlobalAllowance(env, now))) {
    return api({ error: 'AI busy for today', code: 'busy' }, 503);
  }

  const prompt = planPrompt({
    goal: valid.goal!,
    horizonMonths: valid.horizonMonths!,
    hoursPerWeek: valid.hoursPerWeek!,
    level: valid.level,
    kind: valid.kind,
  });

  if (!env.AI_API_KEY && env.AI) {
    try {
      const result = await env.AI.run(env.AI_MODEL || WORKERS_AI_MODEL, {
        messages: [
          { role: 'system', content: 'Return only valid JSON. No markdown outside JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 900,
        temperature: 0.3,
      });
      const steps = cleanSteps(workersAiJson(result));
      if (steps.length === 0) return api({ error: 'AI empty plan', configured: true }, 502);
      return api({ steps }, 200);
    } catch {
      // Free allocation used up or model unavailable: plan on the device.
      return api({ error: 'AI unavailable', code: 'busy' }, 503);
    }
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
          { role: 'user', content: prompt },
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
