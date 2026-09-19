import { afterEach, describe, expect, it, vi } from 'vitest';

import { initSentry, isSentryConfigured, reportError } from './sentry';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isSentryConfigured', () => {
  it('is false when VITE_SENTRY_DSN is missing', () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    expect(isSentryConfigured()).toBe(false);
  });

  it('rejects strings that are not a real Sentry DSN shape', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'not-a-dsn');
    expect(isSentryConfigured()).toBe(false);
    vi.stubEnv('VITE_SENTRY_DSN', 'http://key@o0.ingest.sentry.io/1'); // http, not https
    expect(isSentryConfigured()).toBe(false);
  });

  it('accepts a well-formed DSN', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    expect(isSentryConfigured()).toBe(true);
  });
});

describe('initSentry / reportError (unconfigured installation)', () => {
  it('never throws and never initializes without a DSN', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    await expect(initSentry()).resolves.toBeUndefined();
  });

  it('reportError is a safe no-op before init', async () => {
    await expect(reportError(new Error('boom'))).resolves.toBeUndefined();
  });
});
