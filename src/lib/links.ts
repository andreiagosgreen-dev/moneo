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

/** Open a sanitizer-approved URL in a hardened new tab. False when blocked. */
export function openExternal(url: string): boolean {
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) return false;
    try {
      win.opener = null;
    } catch {
      /* cross-origin — already isolated */
    }
    return true;
  } catch {
    return false;
  }
}
