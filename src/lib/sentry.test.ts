import { afterEach, describe, expect, it, vi } from 'vitest';

describe('sentry stub', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('stays disabled when VITE_SENTRY_DSN is missing', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    const { initSentry, isSentryEnabled, reportError } = await import('./sentry');
    expect(await initSentry()).toBe(false);
    expect(isSentryEnabled()).toBe(false);
    expect(() => reportError(new Error('x'))).not.toThrow();
  });

  it('rejects placeholder / non-Sentry DSN shapes', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'xxx');
    const { initSentry, isSentryEnabled } = await import('./sentry');
    expect(await initSentry()).toBe(false);
    expect(isSentryEnabled()).toBe(false);

    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.com/not-a-dsn');
    vi.resetModules();
    const again = await import('./sentry');
    expect(await again.initSentry()).toBe(false);
  });

  it('fail-closes when the SDK package is unavailable', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc123@o0.ingest.sentry.io/1');
    const { initSentry, isSentryEnabled } = await import('./sentry');
    // Without @sentry/react installed, dynamic import rejects → false.
    expect(await initSentry()).toBe(false);
    expect(isSentryEnabled()).toBe(false);
  });
});
