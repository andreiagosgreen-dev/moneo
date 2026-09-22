import { describe, it, expect } from 'vitest';
import { createBlock, weekdayOfKey, type Weekday } from './timeBlocks';
import { dayKeyInTz } from './timezone';
import { blockEventConflicts, conflictedBlockIdsFromEvents } from './calendarConflicts';
import type { ExternalCalendarEvent } from './googleCalendar';

const TZ = 'UTC';
/** Fixed reference midnight. Its actual weekday is irrelevant — it's
 * derived below via the same helpers the app uses, so the test stays
 * correct regardless of what day this literal timestamp falls on. */
const REF = Date.UTC(2026, 0, 5, 0, 0, 0);
const dateKey = dayKeyInTz(REF, TZ);
const weekday = weekdayOfKey(dateKey);

function event(
  startMin: number,
  endMin: number,
  overrides: Partial<ExternalCalendarEvent> = {},
): ExternalCalendarEvent {
  return {
    id: overrides.id ?? `ev-${startMin}-${endMin}`,
    title: overrides.title ?? 'Meeting',
    startsAt: REF + startMin * 60_000,
    endsAt: REF + endMin * 60_000,
    allDay: overrides.allDay ?? false,
  };
}

describe('blockEventConflicts', () => {
  it('flags a partially overlapping event', () => {
    const block = createBlock({ label: 'Deep work', weekday, startMin: 9 * 60, endMin: 11 * 60 })!;
    const conflicts = blockEventConflicts([block], [event(10 * 60, 12 * 60)], TZ);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapMin).toBe(60);
    expect(conflicts[0].block.id).toBe(block.id);
  });

  it('ignores a non-overlapping event', () => {
    const block = createBlock({ label: 'Deep work', weekday, startMin: 9 * 60, endMin: 11 * 60 })!;
    expect(blockEventConflicts([block], [event(12 * 60, 13 * 60)], TZ)).toHaveLength(0);
  });

  it('flags full containment', () => {
    const block = createBlock({ label: 'Deep work', weekday, startMin: 9 * 60, endMin: 17 * 60 })!;
    const conflicts = blockEventConflicts([block], [event(10 * 60, 11 * 60)], TZ);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapMin).toBe(60);
  });

  it('excludes all-day events', () => {
    const block = createBlock({ label: 'Deep work', weekday, startMin: 0, endMin: 1440 })!;
    const conflicts = blockEventConflicts([block], [event(0, 1440, { allDay: true })], TZ);
    expect(conflicts).toHaveLength(0);
  });

  it('ignores blocks on a different weekday', () => {
    const otherWeekday = ((weekday + 1) % 7) as Weekday;
    const block = createBlock({
      label: 'Deep work',
      weekday: otherWeekday,
      startMin: 9 * 60,
      endMin: 11 * 60,
    })!;
    expect(blockEventConflicts([block], [event(10 * 60, 12 * 60)], TZ)).toHaveLength(0);
  });

  it('clamps a rare cross-midnight event to end at 24:00 same day', () => {
    const block = createBlock({
      label: 'Late block',
      weekday,
      startMin: 22 * 60,
      endMin: 23 * 60 + 59,
    })!;
    // Event starts 23:00 today, ends 01:00 the next calendar day.
    const conflicts = blockEventConflicts([block], [event(23 * 60, 25 * 60)], TZ);
    expect(conflicts).toHaveLength(1);
  });

  it('returns empty for empty inputs', () => {
    expect(blockEventConflicts([], [], TZ)).toEqual([]);
  });
});

describe('conflictedBlockIdsFromEvents', () => {
  it('collects only the ids of blocks that actually conflict', () => {
    const a = createBlock({ label: 'A', weekday, startMin: 9 * 60, endMin: 10 * 60 })!;
    const b = createBlock({ label: 'B', weekday, startMin: 14 * 60, endMin: 15 * 60 })!;
    const ids = conflictedBlockIdsFromEvents([a, b], [event(9 * 60 + 30, 10 * 60 + 30)], TZ);
    expect(ids.has(a.id)).toBe(true);
    expect(ids.has(b.id)).toBe(false);
  });
});
