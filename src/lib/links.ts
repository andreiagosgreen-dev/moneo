/**
 * User-attached link handling (Faza 5A).
 *
 * Links are free text ("URLs/paths"). Only absolute http(s) URLs may be
 * opened externally — everything else stays inert text. Opening always
 * uses `noopener,noreferrer` so a malicious page can never reach
 * `window.opener`.
 */

const MAX_URL_LENGTH = 2000;

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Normalize to an openable https:/http: URL, or null when the value must
 * stay inert (javascript:, data:, ftp:, relative paths, notes, junk).
 * Bare domains ("example.com/x") are upgraded to https://.
 */
export function safeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const clean = raw.trim();
  if (!clean || clean.length > MAX_URL_LENGTH || /\s/.test(clean)) return null;
  const candidate = SCHEME_RE.test(clean) ? clean : `https://${clean}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.hostname) return null;
  return url.href;
}

/**
 * Open a sanitizer-approved URL in a hardened new tab. With `noopener`
 * browsers return null even when the tab did open, so the result only
 * reports a thrown error — never use it to detect a blocked pop-up.
 */
export function openExternal(url: string): boolean {
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win) {
      try {
        win.opener = null;
      } catch {
        /* cross-origin — already isolated */
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Open a payment page we build ourselves (Lemon checkout or customer
 * portal) and make sure the buyer always gets there: a new tab when the
 * browser allows it, otherwise this tab. `noopener` is not passed as a
 * feature (browsers then return null even on success); the opener link is
 * cut right after opening instead.
 */
export function openPaymentPage(
  url: string,
  win: Pick<Window, 'open' | 'location'> = window,
): 'new-tab' | 'same-tab' {
  let tab: Window | null = null;
  try {
    tab = win.open(url, '_blank');
  } catch {
    tab = null;
  }
  if (tab) {
    try {
      tab.opener = null;
    } catch {
      /* cross-origin — already isolated */
    }
    return 'new-tab';
  }
  win.location.assign(url);
  return 'same-tab';
}
