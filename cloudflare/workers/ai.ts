/**
 * Server-side AI planner endpoint (Faza 6, arhitectură sigură).
 *
 * The model is called ONLY here, never in the browser: no API key ever
 * reaches the client. JWT identity, strict input validation, layered
 * rate limits, minimal context (goal text + two numbers — no sessions,
 * no journal, no habits) and an audit trail without goal text.
 *
 * Without AI_API_KEY the endpoint fails closed with 501: the local
 * on-device planner remains fully usable. Wiring a concrete provider
 * is a config decision, not a code change — add the adapter where
 * marked once a key exists.
 */

import { bearerToken, verifyUserToken, type FetchImpl } from './account';
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
}

const aiLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const MAX_AI_BODY_BYTES = 65_536;

export interface ValidAIRequest {
  ok: boolean;
  goal?: string;
  horizonMonths?: number;
  hoursPerWeek?: number;
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
  return { ok: true, goal, horizonMonths, hoursPerWeek };
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
  const userId = await verifyUserToken(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    token,
    fetchImpl,
  );
  if (!userId) return api({ error: 'Invalid or expired session' }, 401);

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
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Return JSON only: {"tasks":[{"title":string,"pomodoros":number,"priority":"p1"|"p2"|"p3"}]}. Max 20 tasks. No prose.',
          },
          {
            role: 'user',
            content: `Goal: ${valid.goal}\nHorizon months: ${valid.horizonMonths}\nHours/week: ${valid.hoursPerWeek}`,
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
    let parsed: { tasks?: Array<{ title?: string; pomodoros?: number; priority?: string }> };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return api({ error: 'AI bad payload', configured: true }, 502);
    }
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks
          .filter((t) => t && typeof t.title === 'string' && t.title.trim())
          .slice(0, 20)
          .map((t, i) => ({
            draftId: `ai-${i + 1}`,
            milestoneId: 'm1',
            title: String(t.title).trim().slice(0, 120),
            pomodoros: Math.min(8, Math.max(1, Math.round(Number(t.pomodoros) || 1))),
            priority: t.priority === 'p1' || t.priority === 'p3' ? t.priority : 'p2',
          }))
      : [];
    if (tasks.length === 0) return api({ error: 'AI empty plan', configured: true }, 502);
    return api(
      {
        path: {
          goal: valid.goal,
          kind: 'general',
          horizonMonths: valid.horizonMonths,
          level: 'beginner',
          hoursPerWeek: valid.hoursPerWeek,
          phases: [{ id: 'p1', index: 1, months: [1, Math.min(3, valid.horizonMonths!)], outcome: valid.goal }],
          milestones: [{ id: 'm1', phaseId: 'p1', title: valid.goal }],
          tasks,
          totalPomodoros: tasks.reduce((n, t) => n + t.pomodoros, 0),
          fitsCapacity: true,
          assumptions: [],
        },
      },
      200,
    );
  } catch {
    return api({ error: 'AI provider unreachable', configured: true }, 502);
  }
}
