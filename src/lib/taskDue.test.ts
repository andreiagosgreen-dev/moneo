import { describe, expect, it } from 'vitest';
import { dueStatus, dueTone, priorityTone } from './taskDue';

const TZ = 'Europe/Bucharest';
// 2026-09-29 14:00 Bucharest (UTC+3).
const NOW = Date.UTC(2026, 8, 29, 11, 0);
const at = (day: number, hour = 12) => Date.UTC(2026, 8, day, hour - 3, 0);

describe('dueStatus', () => {
  it('classifies yesterday, today, tomorrow and further', () => {
    expect(dueStatus(at(28), NOW, TZ)).toEqual({ kind: 'overdue', days: 1 });
    expect(dueStatus(at(26), NOW, TZ)).toEqual({ kind: 'overdue', days: 3 });
    expect(dueStatus(at(29), NOW, TZ)).toEqual({ kind: 'today', days: 0 });
    expect(dueStatus(at(30), NOW, TZ)).toEqual({ kind: 'tomorrow', days: 1 });
    expect(dueStatus(Date.UTC(2026, 9, 4, 9), NOW, TZ)).toEqual({ kind: 'future', days: 5 });
  });

  it('returns null without a usable deadline', () => {
    expect(dueStatus(undefined, NOW, TZ)).toBeNull();
    expect(dueStatus(Number.NaN, NOW, TZ)).toBeNull();
  });

  it('uses calendar days across the DST change, not milliseconds', () => {
    // Late evening 28 Mar -> morning 30 Mar spans the 23 h day: still 2 days.
    const now = Date.UTC(2026, 2, 28, 21, 30);
    const due = Date.UTC(2026, 2, 30, 9, 0);
    expect(dueStatus(due, now, TZ)).toEqual({ kind: 'future', days: 2 });
  });

  it('keeps large overdue counts', () => {
    expect(dueStatus(at(29) - 400 * 86_400_000, NOW, TZ)?.days).toBe(400);
  });
});

describe('tones', () => {
  it('maps priorities', () => {
    expect(priorityTone('p0')).toBe('danger');
    expect(priorityTone('p1')).toBe('accent');
    expect(priorityTone('p2')).toBe('neutral');
    expect(priorityTone('p3')).toBe('outline');
  });
  it('maps due kinds', () => {
    expect(dueTone({ kind: 'overdue', days: 2 })).toBe('danger');
    expect(dueTone({ kind: 'today', days: 0 })).toBe('accent');
    expect(dueTone({ kind: 'tomorrow', days: 1 })).toBe('neutral');
    expect(dueTone({ kind: 'future', days: 4 })).toBe('outline');
  });
});
