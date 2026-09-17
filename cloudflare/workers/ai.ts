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
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 24) {
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
  // PROVIDER ADAPTER GOES HERE: call the model server-side with
  // { goal, horizonMonths, hoursPerWeek } only, tool-constrained output,
  // timeout + per-user cost cap, then return { path }.
  return api({ error: 'AI provider not wired', configured: true }, 501);
}
