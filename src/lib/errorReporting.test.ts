import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildErrorPayload, getSentryDsn, parseDsn } from './errorReporting';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parseDsn', () => {
  it('parses a standard Sentry DSN', () => {
    expect(parseDsn('https://abc123@o456.ingest.sentry.io/789')).toEqual({
      host: 'o456.ingest.sentry.io',
      projectId: '789',
      key: 'abc123',
    });
  });

  it('returns null for absent, empty or malformed input', () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn(null)).toBeNull();
    expect(parseDsn('')).toBeNull();
    expect(parseDsn('not a url')).toBeNull();
    expect(parseDsn('https://o456.ingest.sentry.io/789')).toBeNull(); // no key
    expect(parseDsn('https://abc123@o456.ingest.sentry.io/')).toBeNull(); // no project id
  });
});

describe('getSentryDsn', () => {
  it('returns null when unconfigured, trimmed value when set', () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    expect(getSentryDsn()).toBeNull();
    vi.stubEnv('VITE_SENTRY_DSN', '  https://abc@o1.ingest.sentry.io/1  ');
    expect(getSentryDsn()).toBe('https://abc@o1.ingest.sentry.io/1');
  });
});

describe('buildErrorPayload', () => {
  it('builds a minimal, well-shaped Sentry store payload from a real Error', () => {
    const err = new Error('boom');
    const payload = buildErrorPayload(err, 'development');
    expect(payload.level).toBe('error');
    expect(payload.platform).toBe('javascript');
    expect(payload.environment).toBe('development');
    expect(payload.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(payload.exception.values[0].type).toBe('Error');
    expect(payload.exception.values[0].value).toBe('boom');
  });

  it('coerces a non-Error thrown value into an Error', () => {
    const payload = buildErrorPayload('plain string throw', 'production');
    expect(payload.exception.values[0].value).toBe('plain string throw');
  });

  it('caps message length so a huge payload never gets sent', () => {
    const payload = buildErrorPayload(new Error('x'.repeat(5000)), 'production');
    expect(payload.exception.values[0].value.length).toBeLessThanOrEqual(2000);
  });
});
