import { describe, expect, it } from 'vitest';

import { MIN_PASSWORD_LENGTH, validateNewPassword } from './passwordReset';

describe('validateNewPassword', () => {
  it('requires the minimum length first, then a matching confirmation', () => {
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
    const ok = 'x'.repeat(MIN_PASSWORD_LENGTH);
    expect(validateNewPassword(short, short)).toBe('short');
    expect(validateNewPassword(ok, `${ok}y`)).toBe('mismatch');
    expect(validateNewPassword(ok, ok)).toBeNull();
  });
});
