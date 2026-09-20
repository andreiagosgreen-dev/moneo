import { afterEach, describe, expect, it, vi } from 'vitest';

import { readEnv } from './env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('readEnv', () => {
  it('always returns an object, never throws', () => {
    expect(typeof readEnv()).toBe('object');
    expect(readEnv()).not.toBeNull();
  });

  it('reflects stubbed Vite env vars', () => {
    vi.stubEnv('VITE_MONEO_PROBE', 'hello');
    expect(readEnv().VITE_MONEO_PROBE).toBe('hello');
  });

  it('sees missing vars as undefined', () => {
    expect(readEnv().VITE_MONEO_DEFINITELY_ABSENT_XYZ).toBeUndefined();
  });
});
