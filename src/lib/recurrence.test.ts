import { describe, expect, it } from 'vitest';
import {
  describeRule,
  legacyFromRule,
  matches,
  nextDueKey,
  nextOccurrence,
  normalizeRule,
  ruleFromLegacy,
  type RepeatRule,
} from './recurrence';
import { createI18n } from './i18n';
import { ro } from './i18n/locales/ro';

// 2026-9-28 is a Monday.
describe('normalizeRule', () => {
  it('accepts each kind and tidies weekdays', () => {
    expect(normalizeRule({ kind: 'days', every: 3 })).toEqual({ kind: 'days', every: 3 });
    expect(normalizeRule({ kind: 'weeks', every: 2, weekdays: [3, 0, 3] })).toEqual({
      kind: 'weeks',
      every: 2,
      weekdays: [0, 3],
    });
    expect(normalizeRule({ kind: 'weekdays' })).toEqual({ kind: 'weekdays' });
    expect(normalizeRule({ kind: 'months', every: 1, day: 31 })).toEqual({
      kind: 'months',
      every: 1,
      day: 31,
    });
  });

  it('rejects junk', () => {
    expect(normalizeRule(null)).toBeNull();
    expect(normalizeRule('daily')).toBeNull();
    expect(normalizeRule({ kind: 'days', every: 0 })).toBeNull();
    expect(normalizeRule({ kind: 'days', every: 1.5 })).toBeNull();
    expect(normalizeRule({ kind: 'days', every: 366 })).toBeNull();
    expect(normalizeRule({ kind: 'weeks', every: 1, weekdays: [] })).toBeNull();
    expect(normalizeRule({ kind: 'weeks', every: 1, weekdays: [7] })).toBeNull();
    expect(normalizeRule({ kind: 'months', every: 1, day: 32 })).toBeNull();
    expect(normalizeRule({ kind: 'months', every: 13, day: 1 })).toBeNull();
    expect(normalizeRule({ kind: 'yearly' })).toBeNull();
  });
});

describe('legacy mapping', () => {
  it('maps both ways', () => {
    expect(ruleFromLegacy('daily', '2026-9-30')).toEqual({ kind: 'days', every: 1 });
    expect(ruleFromLegacy('weekly', '2026-9-30')).toEqual({
      kind: 'weeks',
      every: 1,
      weekdays: [2],
    });
    expect(legacyFromRule({ kind: 'days', every: 4 })).toBe('daily');
    expect(legacyFromRule({ kind: 'weekdays' })).toBe('daily');
    expect(legacyFromRule({ kind: 'weeks', every: 1, weekdays: [0] })).toBe('weekly');
    expect(legacyFromRule({ kind: 'months', every: 1, day: 5 })).toBe('weekly');
  });
});

describe('matches / nextOccurrence', () => {
  it('every N days keeps the anchor phase', () => {
    const r: RepeatRule = { kind: 'days', every: 3 };
    expect(matches(r, '2026-10-1', '2026-9-28')).toBe(true);
    expect(matches(r, '2026-9-30', '2026-9-28')).toBe(false);
    expect(matches(r, '2026-9-25', '2026-9-28')).toBe(false);
    expect(nextOccurrence(r, '2026-9-28', '2026-9-28')).toBe('2026-10-1');
  });

  it('every 2 weeks on chosen weekdays keeps week parity', () => {
    const r: RepeatRule = { kind: 'weeks', every: 2, weekdays: [0, 3] };
    expect(nextOccurrence(r, '2026-9-28', '2026-9-28')).toBe('2026-10-1');
    expect(nextOccurrence(r, '2026-10-1', '2026-10-1')).toBe('2026-10-12');
    expect(matches(r, '2026-10-5', '2026-9-28')).toBe(false);
  });

  it('weekdays skip the weekend', () => {
    const r: RepeatRule = { kind: 'weekdays' };
    expect(nextOccurrence(r, '2026-10-2', '2026-10-2')).toBe('2026-10-5');
    expect(nextOccurrence(r, '2026-9-28', '2026-9-28')).toBe('2026-9-29');
  });

  it('monthly on the 31st clamps to shorter months and returns to 31', () => {
    const r: RepeatRule = { kind: 'months', every: 1, day: 31 };
    expect(nextOccurrence(r, '2027-1-31', '2027-1-31')).toBe('2027-2-28');
    expect(nextOccurrence(r, '2027-2-28', '2027-2-28')).toBe('2027-3-31');
    expect(nextOccurrence(r, '2027-3-31', '2027-3-31')).toBe('2027-4-30');
    expect(nextOccurrence(r, '2028-1-31', '2028-1-31')).toBe('2028-2-29');
  });

  it('every 2 months skips the odd month', () => {
    const r: RepeatRule = { kind: 'months', every: 2, day: 15 };
    expect(nextOccurrence(r, '2026-9-15', '2026-9-15')).toBe('2026-11-15');
  });
});

describe('nextDueKey', () => {
  it('jumps past a late completion instead of piling up copies', () => {
    const r: RepeatRule = { kind: 'days', every: 1 };
    expect(nextDueKey(r, '2026-9-20', '2026-9-30')).toBe('2026-10-1');
    expect(nextDueKey({ kind: 'weekdays' }, '2026-9-18', '2026-9-30')).toBe('2026-10-1');
  });

  it('an early completion moves one occurrence on', () => {
    expect(nextDueKey({ kind: 'days', every: 2 }, '2026-10-5', '2026-9-30')).toBe('2026-10-7');
  });
});

describe('describeRule', () => {
  const en = createI18n('en');
  const roI18n = createI18n('ro', ro);

  it('reads naturally in English', () => {
    expect(describeRule({ kind: 'days', every: 1 }, en)).toBe('Every day');
    expect(describeRule({ kind: 'days', every: 3 }, en)).toBe('Every 3 days');
    expect(describeRule({ kind: 'weekdays' }, en)).toBe('Weekdays');
    expect(describeRule({ kind: 'weeks', every: 1, weekdays: [0, 3] }, en)).toBe(
      'Weekly on Mon, Thu',
    );
    expect(describeRule({ kind: 'months', every: 2, day: 31 }, en)).toBe(
      'Every 2 months on day 31',
    );
  });

  it('uses Romanian plural forms', () => {
    expect(describeRule({ kind: 'days', every: 1 }, roI18n)).toBe('Zilnic');
    expect(describeRule({ kind: 'days', every: 3 }, roI18n)).toBe('La fiecare 3 zile');
    expect(describeRule({ kind: 'days', every: 20 }, roI18n)).toBe('La fiecare 20 de zile');
  });
});
