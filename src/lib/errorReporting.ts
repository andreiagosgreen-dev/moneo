import { readEnv } from './env';

/**
 * Minimal error-only reporting to Sentry (Faza 32c).
 *
 * Deliberately NOT the @sentry/browser SDK — this codebase hand-rolls its
 * integrations rather than pull in a ~40kb+ dependency for what is, here,
 * a handful of fields POSTed to Sentry's documented "store" ingest
 * endpoint. No session replay, no performance tracing, no analytics —
 * errors only, matching the privacy-first stance already documented in
 * SECURITY.md. Never throws; absent DSN means "not configured" and every
 * call becomes a no-op (same degrade-gracefully pattern as Supabase/
 * Turnstile elsewhere in this codebase).
 */

interface ParsedDsn {
  host: string;
  projectId: string;
  key: string;
}

/** Never throws. Malformed or absent DSN → null. */
export function parseDsn(raw: string | undefined | null): ParsedDsn | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    const key = url.username;
    const projectId = url.pathname.replace(/^\/+/, '');
    if (!key || !projectId || !url.host) return null;
    return { host: url.host, projectId, key };
  } catch {
    return null;
  }
}

export function getSentryDsn(): string | null {
  try {
    const dsn = readEnv().VITE_SENTRY_DSN;
    return typeof dsn === 'string' && dsn.trim().length > 0 ? dsn.trim() : null;
  } catch {
    return null;
  }
}

function randomEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export interface ErrorReportPayload {
  event_id: string;
  timestamp: string;
  platform: 'javascript';
  level: 'error';
  environment: 'production' | 'development';
  exception: { values: [{ type: string; value: string; extra?: { stack?: string } }] };
}

/** Pure payload builder — kept separate from the network call for testability. */
export function buildErrorPayload(
  error: unknown,
  environment: 'production' | 'development',
): ErrorReportPayload {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    event_id: randomEventId(),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    environment,
    exception: {
      values: [
        {
          type: err.name || 'Error',
          value: err.message.slice(0, 2000),
          ...(err.stack ? { extra: { stack: err.stack.slice(0, 4000) } } : {}),
        },
      ],
    },
  };
}

let installed = false;

/** Fire-and-forget report. No-op without a configured DSN. Never throws. */
export function reportError(error: unknown): void {
  try {
    const parsed = parseDsn(getSentryDsn());
    if (!parsed) return;
    const environment = import.meta.env?.PROD ? 'production' : 'development';
    const payload = buildErrorPayload(error, environment);
    const url = `https://${parsed.host}/api/${parsed.projectId}/store/`;
    const auth = `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=moneo/1.0`;
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': auth },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* best-effort — never let telemetry break the app */
    });
  } catch {
    /* never throws */
  }
}

/**
 * Installs global handlers once. Safe to call multiple times (idempotent).
 * No-op entirely when no DSN is configured — zero listeners added.
 */
export function initErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  if (!parseDsn(getSentryDsn())) return;
  installed = true;
  window.addEventListener('error', (e) => reportError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}
