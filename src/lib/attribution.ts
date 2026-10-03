/**
 * Where a visitor came from — a campaign tag (`?utm_source=tiktok`,
 * `?ref=…`) or, failing that, a known referring site. Only a short label is
 * kept (e.g. "tiktok", "reddit"), never a person or device id, so funnel
 * counters can be split by channel.
 */
import { cleanTag } from './attributionTags';

export { cleanTag };

const REFERRERS: Array<[RegExp, string]> = [
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)yandex\.[a-z.]+$/, 'yandex'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(t\.me|telegram\.org)$/, 'telegram'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'x'],
  [/(^|\.)producthunt\.com$/, 'producthunt'],
];

/** A known site name for the referrer, "other" for the rest, "" for none/self. */
export function sourceFromReferrer(referrer: string, ownHost: string): string {
  let host = '';
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return '';
  }
  if (!host || host === ownHost || host.endsWith(`.${ownHost}`)) return '';
  for (const [re, name] of REFERRERS) if (re.test(host)) return name;
  return 'other';
}

export interface Attribution {
  source: string;
  campaign: string;
  /** When it was captured (ms). */
  at: number;
}

/** Labels from this page load: campaign tags first, then the referrer. */
export function readAttribution(
  search: string,
  referrer: string,
  ownHost: string,
  now: number,
): Attribution | null {
  const params = new URLSearchParams(search);
  const tagged = cleanTag(params.get('utm_source') ?? params.get('ref'));
  if (tagged) {
    return { source: tagged, campaign: cleanTag(params.get('utm_campaign')), at: now };
  }
  const fromSite = sourceFromReferrer(referrer, ownHost);
  return fromSite ? { source: fromSite, campaign: '', at: now } : null;
}

export const ATTRIBUTION_TTL_MS = 30 * 86_400_000;

/**
 * A tagged visit (an ad or a shared link) always wins; a plain referrer only
 * fills an empty or expired slot, so "came back from Google" doesn't erase
 * the campaign that brought someone in.
 */
export function mergeAttribution(
  stored: Attribution | null,
  fresh: Attribution | null,
  now: number,
  freshIsTagged: boolean,
): Attribution | null {
  const live = stored && now - stored.at < ATTRIBUTION_TTL_MS ? stored : null;
  if (fresh && (freshIsTagged || !live)) return fresh;
  return live;
}

const STORAGE_KEY = 'moneo:attribution';

type Nav = { doNotTrack?: string | null; globalPrivacyControl?: boolean };

function optedOut(): boolean {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as Nav;
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

function readStored(): Attribution | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Attribution>;
    const source = cleanTag(v.source);
    return source && typeof v.at === 'number'
      ? { source, campaign: cleanTag(v.campaign), at: v.at }
      : null;
  } catch {
    return null;
  }
}

/** Call once per page load, before any counter is sent. */
export function captureAttribution(now: number = Date.now()): void {
  if (typeof window === 'undefined' || optedOut()) return;
  const params = new URLSearchParams(window.location.search);
  const freshIsTagged = Boolean(cleanTag(params.get('utm_source') ?? params.get('ref')));
  const fresh = readAttribution(
    window.location.search,
    document.referrer,
    window.location.hostname,
    now,
  );
  const next = mergeAttribution(readStored(), fresh, now, freshIsTagged);
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage blocked — counters fall back to "direct" */
  }
}

/** The channel to attach to counters and checkout: "direct" when unknown. */
export function currentSource(now: number = Date.now()): { source: string; campaign: string } {
  if (optedOut()) return { source: '', campaign: '' };
  const stored = readStored();
  if (stored && now - stored.at < ATTRIBUTION_TTL_MS) {
    return { source: stored.source, campaign: stored.campaign };
  }
  return { source: 'direct', campaign: '' };
}
