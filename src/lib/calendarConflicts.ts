/**
 * Block ↔ real-calendar-event conflict detection (Roadmap Faza 10).
 *
 * `TimeBlock` is a weekly-recurring template (weekday + minute-of-day); a
 * Google Calendar event is a dated instance. Coercing one into the other
 * would make a one-off meeting look like it recurs every week forever, so
 * this stays a separate pure function rather than folding events into
 * `blockConflicts()` in `timeBlocks.ts`. Zero I/O, fully unit-testable.
 */
import { blocksForWeekday, weekdayOfKey, minuteOfDayInTz, type TimeBlock } from './timeBlocks';
import { dayKeyInTz } from './timezone';
import type { ExternalCalendarEvent } from './googleCalendar';

export interface BlockEventConflict {
  block: TimeBlock;
  event: ExternalCalendarEvent;
  dateKey: string;
  overlapMin: number;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/**
 * Conflicts between recurring blocks and dated external events, in the
 * given timezone. All-day events carry no meaningful minute-of-day overlap
 * and are excluded (informational only, out of scope here). A rare
 * cross-midnight event is clamped to end at 24:00 same-day rather than
 * split across two days.
 */
export function blockEventConflicts(
  blocks: TimeBlock[],
  events: ExternalCalendarEvent[],
  timezone: string,
): BlockEventConflict[] {
  const out: BlockEventConflict[] = [];
  for (const event of events) {
    if (event.allDay) continue;
    const dateKey = dayKeyInTz(event.startsAt, timezone);
    const weekday = weekdayOfKey(dateKey);
    const startMod = minuteOfDayInTz(event.startsAt, timezone);
    const sameDayEnd =
      dayKeyInTz(event.endsAt, timezone) === dateKey
        ? minuteOfDayInTz(event.endsAt, timezone)
        : 1440;
    const endMod = Math.max(startMod, sameDayEnd);
    for (const block of blocksForWeekday(blocks, weekday)) {
      const overlapMin = overlap(startMod, endMod, block.startMin, block.endMin);
      if (overlapMin > 0) out.push({ block, event, dateKey, overlapMin });
    }
  }
  return out;
}

/** Ids of every block involved in at least one block↔event conflict. */
export function conflictedBlockIdsFromEvents(
  blocks: TimeBlock[],
  events: ExternalCalendarEvent[],
  timezone: string,
): Set<string> {
  const ids = new Set<string>();
  for (const c of blockEventConflicts(blocks, events, timezone)) ids.add(c.block.id);
  return ids;
}
