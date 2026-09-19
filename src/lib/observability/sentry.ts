import { readEnv } from '../env';

/**
 * Error monitoring (Roadmap Faza 5A — "Sentry wired into sync/billing
 * errors"). Opt-in and lazy, same shape as billing/email: `isConfigured`
 * only inspects env, `init` never throws, and the SDK itself is only
 * fetched (dynamic import) when a DSN is actually present — an unconfigured
 * installation pays zero bytes and makes zero network calls, matching the
 * local-first principle everywhere else in this codebase.
 *
 * No PII is sent: Sentry's default `sendDefaultPii` stays off, and no user
 * id/email is attached to events (Faza 5A — "minimize what leaves the
 * device").
 */

/** Never throws. Pure environment inspection. */
export function isSentryConfigured(): boolean {
  try {
    const dsn = readEnv().VITE_SENTRY_DSN;
    return typeof dsn === 'string' && /^https:\/\/.+@.+\.ingest\..+\/\d+$/.test(dsn.trim());
  } catch {
    return false;
  }
}

let initialized = false;

/**
 * Call once at app boot. No-op (and no network activity) when
 * VITE_SENTRY_DSN isn't set. Safe to call multiple times.
 */
export async function initSentry(): Promise<void> {
  if (initialized || !isSentryConfigured()) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn: readEnv().VITE_SENTRY_DSN,
      sendDefaultPii: false,
      // Errors only — no session replay, no perf tracing. Keeps the
      // integration small and avoids capturing user input by default.
      integrations: [],
      tracesSampleRate: 0,
    });
    initialized = true;
  } catch {
    /* Sentry itself failing to load must never break the app. */
  }
}

/** Reports an error if Sentry is configured; always a safe no-op otherwise. */
export async function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!initialized) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* never throw from error reporting */
  }
}
