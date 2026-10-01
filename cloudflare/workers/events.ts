/**
 * `POST /api/event` — anonymous product counters (conversion funnel).
 *
 * Only an allowlisted event name, an allowlisted plan and the interface
 * language are recorded — no user id, no IP, no free text, nothing that
 * identifies a person. Points go to Workers Analytics Engine when the
 * `EVENTS` dataset is bound; without it the endpoint is a silent no-op.
 * Always answers 204 so a blocked or failed beacon never affects the app.
 */

import { buildSecurityHeaders, declaredBodyTooLarge, mergeHeaders } from './security';

export const EVENT_NAMES: ReadonlySet<string> = new Set([
  'onboarding_start',
  'onboarding_done',
  'first_focus_done',
  'pricing_view',
  'upgrade_intent',
  'checkout_open',
]);

const PLANS: ReadonlySet<string> = new Set(['pro-monthly', 'pro-yearly']);
const LANGS: ReadonlySet<string> = new Set(['en', 'ro', 'ru', 'uk', 'de', 'fr', 'es', 'it']);

export interface AnalyticsDataset {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

export interface EventsEnv {
  EVENTS?: AnalyticsDataset;
}

export interface CleanEvent {
  name: string;
  plan: string;
  lang: string;
}

/** Keep only allowlisted values; null drops the event. */
export function cleanEvent(body: unknown): CleanEvent | null {
  if (!body || typeof body !== 'object') return null;
  const rec = body as Record<string, unknown>;
  const name = typeof rec.e === 'string' ? rec.e : '';
  if (!EVENT_NAMES.has(name)) return null;
  const plan = typeof rec.p === 'string' && PLANS.has(rec.p) ? rec.p : '';
  const lang = typeof rec.l === 'string' && LANGS.has(rec.l) ? rec.l : '';
  return { name, plan, lang };
}

const noContent = () =>
  new Response(null, { status: 204, headers: mergeHeaders(buildSecurityHeaders(), {}) });

export async function handleEvent(request: Request, env: EventsEnv): Promise<Response> {
  if (request.method !== 'POST') return noContent();
  if (declaredBodyTooLarge(request, 1024)) return noContent();
  try {
    const raw = await request.text();
    if (raw.length > 1024) return noContent();
    const event = cleanEvent(JSON.parse(raw));
    if (event && env.EVENTS) {
      env.EVENTS.writeDataPoint({
        indexes: [event.name],
        blobs: [event.name, event.plan, event.lang],
        doubles: [1],
      });
    }
  } catch {
    /* malformed beacons are dropped */
  }
  return noContent();
}
