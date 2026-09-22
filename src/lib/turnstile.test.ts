import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTurnstileSiteKey } from './turnstile';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getTurnstileSiteKey', () => {
  it('returns null when unconfigured', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    expect(getTurnstileSiteKey()).toBeNull();
  });

  it('returns the trimmed key when set', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '  0x4AAA...  ');
    expect(getTurnstileSiteKey()).toBe('0x4AAA...');
  });

  it('never throws', () => {
    expect(() => getTurnstileSiteKey()).not.toThrow();
  });
});
