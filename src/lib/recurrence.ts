/* Flexible repeat rules on day keys. Pure and timezone-free. */
import {
  addDays,
  compareDayKeys,
  dayKeyDiff,
  daysInMonth,
  mondayOf,
  parseDayKey,
  weekdayIndexMon,
} from './dayKeys';
import type { I18n } from './i18n';

export type RepeatRule =
  /** every 1 = daily */
  | { kind: 'days'; every: number }
  /** weekdays 0 = Monday .. 6 = Sunday; non-empty, sorted, unique */
  | { kind: 'weeks'; every: number; weekdays: number[] }
  /** Monday to Friday */
  | { kind: 'weekdays' }
  /** day 1..31, clamped to the month's last day */
  | { kind: 'months'; every: number; day: number };

export type RepeatKind = RepeatRule['kind'];

const LIMITS = { days: 365, weeks: 52, months: 12 } as const;
const MAX_SCAN = 3660;

const intIn = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;

/** A valid rule, or null for anything malformed. */
export function normalizeRule(raw: unknown): RepeatRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case 'days': {
      const every = intIn(r.every, 1, LIMITS.days);
      return every === null ? null : { kind: 'days', every };
    }
    case 'weeks': {
      const every = intIn(r.every, 1, LIMITS.weeks);
      if (every === null || !Array.isArray(r.weekdays)) return null;
      const days = r.weekdays.map((d) => intIn(d, 0, 6));
      if (days.length === 0 || days.some((d) => d === null)) return null;
      const weekdays = [...new Set(days as number[])].sort((a, b) => a - b);
      return { kind: 'weeks', every, weekdays };
    }
    case 'weekdays':
      return { kind: 'weekdays' };
    case 'months': {
      const every = intIn(r.every, 1, LIMITS.months);
      const day = intIn(r.day, 1, 31);
      return every === null || day === null ? null : { kind: 'months', every, day };
    }
    default:
      return null;
  }
}

export function ruleFromLegacy(rec: 'daily' | 'weekly', dueKey: string): RepeatRule {
  return rec === 'daily'
    ? { kind: 'days', every: 1 }
    : { kind: 'weeks', every: 1, weekdays: [weekdayIndexMon(dueKey)] };
}

/** Closest old-style value, so clients without `repeat` keep repeating. */
export function legacyFromRule(rule: RepeatRule): 'daily' | 'weekly' {
  return rule.kind === 'days' || rule.kind === 'weekdays' ? 'daily' : 'weekly';
}

/** Does `key` fall on the rule? `anchorKey` (the original due day) fixes the "every N" phase. */
export function matches(rule: RepeatRule, key: string, anchorKey: string): boolean {
  const p = parseDayKey(key);
  const a = parseDayKey(anchorKey);
  if (!p || !a) return false;
  switch (rule.kind) {
    case 'days': {
      const diff = dayKeyDiff(anchorKey, key);
      return diff >= 0 && diff % rule.every === 0;
    }
    case 'weeks': {
      if (!rule.weekdays.includes(weekdayIndexMon(key))) return false;
      const weeks = dayKeyDiff(mondayOf(anchorKey), mondayOf(key)) / 7;
      return weeks >= 0 && weeks % rule.every === 0;
    }
    case 'weekdays':
      return weekdayIndexMon(key) < 5;
    case 'months': {
      const months = (p.y - a.y) * 12 + (p.m - a.m);
      if (months < 0 || months % rule.every !== 0) return false;
      return p.d === Math.min(rule.day, daysInMonth(p.y, p.m));
    }
  }
}

/** First key strictly after `afterKey` that matches the rule. */
export function nextOccurrence(rule: RepeatRule, anchorKey: string, afterKey: string): string {
  let key = addDays(afterKey, 1);
  for (let i = 0; i < MAX_SCAN; i++) {
    if (matches(rule, key, anchorKey)) return key;
    key = addDays(key, 1);
  }
  return addDays(afterKey, 1);
}

/**
 * Next due day after completing: late completions jump to the next future
 * occurrence instead of piling up overdue copies.
 */
export function nextDueKey(rule: RepeatRule, dueKey: string, completedKey: string): string {
  const after = compareDayKeys(completedKey, dueKey) > 0 ? completedKey : dueKey;
  return nextOccurrence(rule, dueKey, after);
}

/** Short weekday names, Monday first. */
export function weekdayNames(tag: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i);
    try {
      return new Intl.DateTimeFormat(tag, { weekday: 'short' }).format(d);
    } catch {
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i];
    }
  });
}

/** Human summary, e.g. "Every 2 weeks on Mon, Thu". */
export function describeRule(rule: RepeatRule, i18n: Pick<I18n, 't' | 'tp' | 'tag'>): string {
  switch (rule.kind) {
    case 'days':
      return rule.every === 1
        ? i18n.t('task.rep.sum.everyDay')
        : i18n.tp('task.rep.sum.days', rule.every);
    case 'weeks': {
      const names = weekdayNames(i18n.tag);
      const days = rule.weekdays.map((d) => names[d]).join(', ');
      return rule.every === 1
        ? i18n.t('task.rep.sum.everyWeek', { days })
        : i18n.tp('task.rep.sum.weeks', rule.every, { days });
    }
    case 'weekdays':
      return i18n.t('task.rep.sum.weekdays');
    case 'months':
      return rule.every === 1
        ? i18n.t('task.rep.sum.everyMonth', { day: rule.day })
        : i18n.tp('task.rep.sum.months', rule.every, { day: rule.day });
  }
}
