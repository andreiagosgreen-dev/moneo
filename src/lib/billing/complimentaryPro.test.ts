import { describe, expect, it } from 'vitest';

import {
  COMPLIMENTARY_PRO_EMAILS,
  hasComplimentaryPro,
  normalizeComplimentaryEmail,
  parseComplimentaryProEmails,
  resolveComplimentaryAllowlist,
  resolveIsPro,
} from './complimentaryPro';

describe('complimentaryPro — allowlist helpers', () => {
  it('normalizes email case and whitespace', () => {
    expect(normalizeComplimentaryEmail('  Foo@Example.COM ')).toBe('foo@example.com');
  });

  it('parses comma / semicolon / whitespace env lists and drops junk', () => {
    expect(parseComplimentaryProEmails('a@x.com, B@Y.com;c@z.com  d@w.com')).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
      'd@w.com',
    ]);
    expect(parseComplimentaryProEmails('')).toEqual([]);
    expect(parseComplimentaryProEmails(null)).toEqual([]);
    expect(parseComplimentaryProEmails('nope, also-bad')).toEqual([]);
    expect(parseComplimentaryProEmails('a@x.com, a@x.com, A@X.com')).toEqual(['a@x.com']);
  });

  it('merges hardcoded + env without duplicates', () => {
    expect(resolveComplimentaryAllowlist('b@y.com, a@x.com', ['A@X.com', 'c@z.com'])).toEqual([
      'a@x.com',
      'c@z.com',
      'b@y.com',
    ]);
  });

  it('ships the permanent complimentary Pro allowlist (lowercase)', () => {
    expect(COMPLIMENTARY_PRO_EMAILS).toEqual([
      'atsolutionsrl.md@gmail.com',
      'sandamihailov3@gmail.com',
    ]);
  });

  it('matches allowlisted emails case-insensitively', () => {
    const list = ['owner@moneo.bond', 'friend@example.com'];
    expect(hasComplimentaryPro('Owner@Moneo.Bond', list)).toBe(true);
    expect(hasComplimentaryPro('friend@example.com', list)).toBe(true);
    expect(hasComplimentaryPro('other@example.com', list)).toBe(false);
    expect(hasComplimentaryPro(null, list)).toBe(false);
    expect(hasComplimentaryPro('  ', list)).toBe(false);
  });

  it('resolveIsPro ORs paid Lemon with complimentary', () => {
    const list = ['comp@example.com'];
    expect(resolveIsPro(true, 'anyone@x.com', list)).toBe(true);
    expect(resolveIsPro(false, 'comp@example.com', list)).toBe(true);
    expect(resolveIsPro(false, 'free@example.com', list)).toBe(false);
  });
});
