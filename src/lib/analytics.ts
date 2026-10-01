/**
 * Anonymous conversion counters (see cloudflare/workers/events.ts).
 *
 * Sends only an event name, an optional plan and the interface language — no
 * user id, no content. Respects Do Not Track / Global Privacy Control, and is
 * fire-and-forget: a blocked beacon never affects the app.
 */

export type ProductEvent =
  | 'onboarding_start'
  | 'onboarding_done'
  | 'first_focus_done'
  | 'pricing_view'
  | 'upgrade_intent'
  | 'checkout_open';

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
): boolean {
  if (optedOut(nav) || !nav?.sendBeacon) return false;
  try {
    const body = JSON.stringify({
      e: event,
      ...(plan ? { p: plan } : {}),
      l: (lang ?? nav.language ?? '').slice(0, 2).toLowerCase(),
    });
    return nav.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }));
  } catch {
    return false;
  }
}
