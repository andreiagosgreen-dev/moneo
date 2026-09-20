import * as Sentry from '@sentry/react';

/**
 * Error monitoring (Roadmap: Etapa 1.9 / 2.10). Opt-in by configuration, not
 * by code path: without VITE_SENTRY_DSN this is a total no-op, so dev/self-
 * hosted builds never talk to Sentry. No session replay — Life Map, journal
 * and energy log are local-only by design (see SECURITY.md) and a replay
 * integration would defeat that even with text masked. Errors/stack traces
 * only; no user PII beyond the Supabase user id already used app-wide.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

/** Safe no-op when Sentry isn't initialized (no DSN configured). */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
