/**
 * `POST /api/event` — anonymous product counters (conversion funnel).
 *
 * Only an allowlisted event name, an allowlisted plan, the interface
 * language and the channel label that brought the visitor (e.g. "tiktok",
 * cleaned to [a-z0-9._-]) are recorded — no user id, no IP, no free text,
 * nothing that identifies a person. Points go to Workers Analytics Engine when the
 * `EVENTS` dataset is bound; without it the endpoint is a silent no-op.
 * Always answers 204 so a blocked or failed beacon never affects the app.
 */

import { cleanTag } from '../../src/lib/attributionTags';
import { buildSecurityHeaders, declaredBodyTooLarge, mergeHeaders } from './security';

export const EVENT_NAMES: ReadonlySet<string> = new Set([
  'onboarding_start',
  'onboarding_done',
  'first_focus_done',
  'pricing_view',
  'upgrade_intent',
  'checkout_open',
  'landing_view',
]);

/** Written by the Worker itself (sign-up, Lemon webhooks), never by the client. */
export type ServerEventName = 'sign_up' | 'subscribe' | 'payment';

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
  source: string;
  campaign: string;
}

/** Keep only allowlisted values; null drops the event. */
export function cleanEvent(body: unknown): CleanEvent | null {
  if (!body || typeof body !== 'object') return null;
  const rec = body as Record<string, unknown>;
  const name = typeof rec.e === 'string' ? rec.e : '';
  if (!EVENT_NAMES.has(name)) return null;
  const plan = typeof rec.p === 'string' && PLANS.has(rec.p) ? rec.p : '';
  const lang = typeof rec.l === 'string' && LANGS.has(rec.l) ? rec.l : '';
  return { name, plan, lang, source: cleanTag(rec.s), campaign: cleanTag(rec.c) };
}

/**
 * One counter point. Blobs: name, plan, lang, source, campaign, status;
 * doubles: count, revenue in USD (payments only). Old points have 3 blobs.
 */
export function writeEvent(
  env: EventsEnv,
  e: {
    name: string;
    plan?: string;
    lang?: string;
    source?: string;
    campaign?: string;
    status?: string;
    revenueUsd?: number;
  },
): void {
  if (!env.EVENTS) return;
  const plan = e.plan && PLANS.has(e.plan) ? e.plan : '';
  const lang = e.lang && LANGS.has(e.lang) ? e.lang : '';
  env.EVENTS.writeDataPoint({
    indexes: [e.name],
    blobs: [
      e.name,
      plan,
      lang,
      cleanTag(e.source) || 'direct',
      cleanTag(e.campaign),
      cleanTag(e.status),
    ],
    doubles: [1, Number.isFinite(e.revenueUsd) ? Number(e.revenueUsd) : 0],
  });
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
    if (event) writeEvent(env, event);
  } catch {
    /* malformed beacons are dropped */
  }
  return noContent();
}
