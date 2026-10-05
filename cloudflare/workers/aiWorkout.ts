/**
 * Included AI for workout packs (Pro): "describe the workout you want" →
 * zone, length, format, level and up to 8 exercises picked ONLY from the
 * catalogue the app sends (ids the user can do with their place and gear).
 *
 * Same guards as the AI planner: JWT, server-side Pro check, strict input
 * validation, per-IP limiter, per-account daily allowance (own counter) and
 * the shared global cap. Minimal context: the request text (≤ 300 chars) and
 * the catalogue ids; nothing is stored, the text is not logged.
 */
import { bearerToken, verifyUser, type FetchImpl } from './account';
import { hasServerProAccess } from './proAccess';
import {
  WORKERS_AI_MODEL,
  takeDailyAllowance,
  takeGlobalAllowance,
  workersAiJson,
  type AIEnv,
} from './ai';
import {
  buildSecurityHeaders,
  clientIp,
  createRateLimiter,
  declaredBodyTooLarge,
  mergeHeaders,
} from './security';

export const WORKOUT_ZONES = [
  'full',
  'core',
  'upper',
  'lower',
  'glutes',
  'back',
  'cardio',
  'mobility',
] as const;
export const WORKOUT_FORMATS = ['circuit', 'sets', 'tabata'] as const;
export const WORKOUT_MINUTES = [10, 15, 20, 30, 45, 60] as const;
const MAX_TEXT = 300;
const MAX_CATALOG = 220;
const MAX_PICKS = 8;
const MAX_BODY = 32_768;
/** "id|mainMuscle|equipment|level", no free text. */
const CATALOG_ROW = /^[A-Za-z]{2,30}\|[A-Za-z]{2,15}\|[A-Za-z]{2,15}\|[123]$/;

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export interface ValidWorkoutRequest {
  ok: boolean;
  text?: string;
  catalog?: string[];
  reason?: string;
}

export function validateWorkoutRequest(body: unknown): ValidWorkoutRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'Invalid payload' };
  }
  const rec = body as Record<string, unknown>;
  const text = typeof rec.text === 'string' ? rec.text.trim() : '';
  if (!text) return { ok: false, reason: 'Missing text' };
  if (text.length > MAX_TEXT) return { ok: false, reason: 'Text too long' };
  if (!Array.isArray(rec.catalog) || rec.catalog.length === 0) {
    return { ok: false, reason: 'Missing catalog' };
  }
  if (rec.catalog.length > MAX_CATALOG) return { ok: false, reason: 'Catalog too long' };
  if (!rec.catalog.every((r) => typeof r === 'string' && CATALOG_ROW.test(r))) {
    return { ok: false, reason: 'Bad catalog' };
  }
  return { ok: true, text, catalog: [...new Set(rec.catalog as string[])] };
}

export function workoutPrompt(text: string, catalog: string[]): string {
  return [
    'You are a careful fitness coach. Build ONE workout for this request (any language):',
    JSON.stringify(text),
    '',
    'Answer with JSON only:',
    `{"zone": one of ${JSON.stringify(WORKOUT_ZONES)},`,
    ` "minutes": one of ${JSON.stringify(WORKOUT_MINUTES)},`,
    ` "format": one of ${JSON.stringify(WORKOUT_FORMATS)},`,
    ' "level": 1 (beginner) | 2 | 3 (advanced),',
    ` "exercises": up to ${MAX_PICKS} ids from the catalogue that best fit the request}`,
    '',
    'Rules: use only ids from the catalogue; prefer the equipment the request mentions;',
    'pick level 1 unless the request asks for harder; for pain or injury choose gentle',
    'mobility and low levels and never give medical advice.',
    '',
    'Catalogue (id | main muscle | equipment | level):',
    ...catalog,
  ].join('\n');
}

export interface WorkoutAnswer {
  zone: (typeof WORKOUT_ZONES)[number];
  minutes: number;
  format: (typeof WORKOUT_FORMATS)[number];
  level: 1 | 2 | 3;
  exercises: string[];
}

/** Keeps only allowed values and catalogue ids; null when the zone is unusable. */
export function cleanWorkoutAnswer(json: unknown, catalog: string[]): WorkoutAnswer | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, unknown>;
  const zone = WORKOUT_ZONES.find((z) => z === j.zone);
  if (!zone) return null;
  const minutes = WORKOUT_MINUTES.includes(j.minutes as 10) ? (j.minutes as number) : 20;
  const format = WORKOUT_FORMATS.find((f) => f === j.format) ?? 'circuit';
  const level = j.level === 2 || j.level === 3 ? j.level : 1;
  const ids = new Set(catalog.map((r) => r.split('|')[0]));
  const exercises = Array.isArray(j.exercises)
    ? [...new Set(j.exercises.filter((e): e is string => typeof e === 'string' && ids.has(e)))]
    : [];
  return { zone, minutes, format, level, exercises: exercises.slice(0, MAX_PICKS) };
}

function api(body: Record<string, unknown>, status: number, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(buildSecurityHeaders(), { 'Content-Type': 'application/json', ...extra }),
  });
}

async function runModel(env: AIEnv, prompt: string, fetchImpl: FetchImpl): Promise<unknown> {
  const messages = [
    { role: 'system', content: 'Return only valid JSON. No markdown outside JSON.' },
    { role: 'user', content: prompt },
  ];
  if (!env.AI_API_KEY && env.AI) {
    const result = await env.AI.run(env.AI_MODEL || WORKERS_AI_MODEL, {
      messages,
      max_tokens: 300,
      temperature: 0.2,
    });
    return workersAiJson(result);
  }
  const base = (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
      body: JSON.stringify({
        model: env.AI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return JSON.parse(data?.choices?.[0]?.message?.content ?? 'null');
  } finally {
    clearTimeout(timer);
  }
}

export async function handleAIWorkout(
  request: Request,
  env: AIEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'POST') return api({ error: 'Method not allowed' }, 405);
  if (!limiter(`aiw:${clientIp(request)}`)) {
    return api({ error: 'Too many requests' }, 429, { 'Retry-After': '60' });
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return api({ error: 'AI not configured' }, 503);
  }
  const token = bearerToken(request);
  if (!token) return api({ error: 'Missing or invalid authorization' }, 401);
  const user = await verifyUser(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, token, fetchImpl);
  if (!user) return api({ error: 'Invalid or expired session' }, 401);
  if (!(await hasServerProAccess(env, user.userId, user.email, fetchImpl, user.createdAt))) {
    return api({ error: 'Pro feature', code: 'not_pro' }, 403);
  }
  if (declaredBodyTooLarge(request, MAX_BODY)) return api({ error: 'Payload too large' }, 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return api({ error: 'Payload too large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return api({ error: 'Invalid JSON' }, 400);
  }
  const valid = validateWorkoutRequest(body);
  if (!valid.ok) return api({ error: valid.reason ?? 'Invalid payload' }, 400);

  // Audit: who and when; the request text is deliberately not logged.
  console.log(
    JSON.stringify({
      event: 'ai.workout.request',
      user: user.userId,
      at: new Date().toISOString(),
    }),
  );
  if (!env.AI_API_KEY && !env.AI)
    return api({ error: 'AI not configured', configured: false }, 501);

  const now = new Date();
  if (!(await takeDailyAllowance(env, user.userId, now, 'ai-workout'))) {
    return api({ error: 'Daily AI limit reached', code: 'daily_limit' }, 429);
  }
  if (!(await takeGlobalAllowance(env, now))) {
    return api({ error: 'AI busy for today', code: 'busy' }, 503);
  }
  try {
    const answer = cleanWorkoutAnswer(
      await runModel(env, workoutPrompt(valid.text!, valid.catalog!), fetchImpl),
      valid.catalog!,
    );
    if (!answer) return api({ error: 'AI empty answer' }, 502);
    return api({ ...answer }, 200);
  } catch {
    return api({ error: 'AI unavailable', code: 'busy' }, 503);
  }
}
