import { describe, expect, it } from 'vitest';

import { isEngagedUser, ENGAGED_SESSION_THRESHOLD } from './engagement';

describe('isEngagedUser', () => {
  it('exposes a 5-session threshold', () => {
    expect(ENGAGED_SESSION_THRESHOLD).toBe(5);
  });

  it('is false for a brand-new workspace', () => {
    expect(isEngagedUser([], [])).toBe(false);
  });

  it('is true after enough sessions', () => {
    const history = Array.from({ length: 5 }, () => ({ min: 25 }));
    expect(isEngagedUser(history, [])).toBe(true);
    expect(isEngagedUser([{ min: 25 }], [])).toBe(false);
  });

  it('is true once the user created a project', () => {
    expect(isEngagedUser([], [{ archived: false }])).toBe(true);
    expect(isEngagedUser([], [{ archived: true }])).toBe(false);
  });

  it('never throws on junk input', () => {
    expect(isEngagedUser(null as never, null as never)).toBe(false);
    expect(isEngagedUser([], [null as never])).toBe(false);
  });
});
