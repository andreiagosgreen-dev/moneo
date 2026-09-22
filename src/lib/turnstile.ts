import { readEnv } from './env';

/**
 * Cloudflare Turnstile site key (Faza 32a — bot/abuse protection on
 * signup+login). Public by design, like a reCAPTCHA site key — safe in
 * the client bundle. Never throws; absent env means "not configured",
 * and the widget simply doesn't render (local-first: auth still works
 * without it, same degrade-gracefully pattern as everywhere else here).
 */
export function getTurnstileSiteKey(): string | null {
  try {
    const key = readEnv().VITE_TURNSTILE_SITE_KEY;
    return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null;
  } catch {
    return null;
  }
}
