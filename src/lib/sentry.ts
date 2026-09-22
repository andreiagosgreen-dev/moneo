/**
 * Optional Sentry (frontend). Fail-closed:
 * - no / invalid VITE_SENTRY_DSN → no-op
 * - `@sentry/react` not installed → no-op (dynamic import)
 *
 * Keep the main bundle light: the SDK loads only when a real DSN is set.
 * Install when ready: `npm i @sentry/react` then paste the project DSN.
 */

import { readEnv } from './env';

type SentryMod = {
  init: (opts: {
    dsn: string;
    environment?: string;
    tracesSampleRate?: number;
  }) => void;
  captureException: (error: unknown, hint?: { extra?: Record<string, unknown> }) => void;
};

let enabled = false;
let sentryMod: SentryMod | null = null;

function readDsn(): string | null {
  const raw = readEnv().VITE_SENTRY_DSN?.trim();
  if (!raw) return null;
  // Reject placeholders / non-HTTPS so we never init against junk.
  if (!/^https:\/\/.+@.+/.test(raw)) return null;
  return raw;
}

/** True after a successful init (DSN present and SDK loaded). */
export function isSentryEnabled(): boolean {
  return enabled;
}

/**
 * Call once at app boot. Safe to await or fire-and-forget.
 * Returns whether reporting is active.
 */
export async function initSentry(): Promise<boolean> {
  const dsn = readDsn();
  if (!dsn) {
    enabled = false;
    sentryMod = null;
    return false;
  }
  try {
    // Variable + @vite-ignore so Vite does not statically resolve an optional peer.
    const sentryPkg = '@sentry/react';
    const mod = (await import(/* @vite-ignore */ sentryPkg)) as SentryMod;
    mod.init({
      dsn,
      environment: readEnv().MODE || 'production',
      tracesSampleRate: 0,
    });
    sentryMod = mod;
    enabled = true;
    return true;
  } catch {
    enabled = false;
    sentryMod = null;
    return false;
  }
}

/** Report an error when Sentry is live; otherwise silently no-op. */
export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  if (!enabled || !sentryMod) return;
  try {
    sentryMod.captureException(error, extra ? { extra } : undefined);
  } catch {
    // fail-closed
  }
}
