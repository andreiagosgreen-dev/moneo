/**
 * Anonymous conversion counters (see cloudflare/workers/events.ts).
 *
 * Sends only an event name, an optional plan, the interface language and the
 * channel label that brought the visitor (src/lib/attribution.ts) — no user
 * id, no content. Respects Do Not Track / Global Privacy Control, and is
 * fire-and-forget: a blocked beacon never affects the app.
 */
import { currentSource } from './attribution';

export type ProductEvent =
  | 'onboarding_start'
  | 'onboarding_done'
  | 'first_focus_done'
  | 'first_task_added'
  | 'first_try_done'
  | 'first_steps_done'
  | 'pricing_view'
  | 'upgrade_intent'
  | 'checkout_open'
  | 'landing_view';

type Nav = {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
  sendBeacon?: (url: string, data?: BodyInit | null) => boolean;
  language?: string;
};

export function optedOut(nav: Nav | undefined): boolean {
  return !nav || nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

export function track(
  event: ProductEvent,
  plan?: 'pro-monthly' | 'pro-yearly',
  lang?: string,
  nav: Nav | undefined = typeof navigator !== 'undefined' ? (navigator as Nav) : undefined,
  channel: { source: string; campaign: string } = currentSource(),
): boolean {
  if (optedOut(nav) || !nav?.sendBeacon) return false;
  try {
    const body = JSON.stringify({
      e: event,
      ...(plan ? { p: plan } : {}),
      l: (lang ?? nav.language ?? '').slice(0, 2).toLowerCase(),
      ...(channel.source ? { s: channel.source } : {}),
      ...(channel.campaign ? { c: channel.campaign } : {}),
    });
    return nav.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }));
  } catch {
    return false;
  }
}
