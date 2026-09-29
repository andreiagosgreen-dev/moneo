import type { TaskPriority } from './tasks';
import type { PillTone } from '../mono/MonoPill';
import { dayKeyDiff } from './dayKeys';
import { dayKeyInTz } from './timezone';

export type DueKind = 'overdue' | 'today' | 'tomorrow' | 'future';

export interface DueStatus {
  kind: DueKind;
  /** Absolute calendar-day distance; 0 for today. */
  days: number;
}

/** Due status of a task deadline, on calendar days in the given timezone. */
export function dueStatus(
  dueAt: number | undefined,
  now: number,
  timezone: string,
): DueStatus | null {
  if (typeof dueAt !== 'number' || !Number.isFinite(dueAt)) return null;
  const diff = dayKeyDiff(dayKeyInTz(now, timezone), dayKeyInTz(dueAt, timezone));
  if (Number.isNaN(diff)) return null;
  if (diff < 0) return { kind: 'overdue', days: -diff };
  if (diff === 0) return { kind: 'today', days: 0 };
  if (diff === 1) return { kind: 'tomorrow', days: 1 };
  return { kind: 'future', days: diff };
}

export function priorityTone(p: TaskPriority): PillTone {
  if (p === 'p0') return 'danger';
  if (p === 'p1') return 'accent';
  if (p === 'p2') return 'neutral';
  return 'outline';
}

export function dueTone(s: DueStatus): PillTone {
  if (s.kind === 'overdue') return 'danger';
  if (s.kind === 'today') return 'accent';
  if (s.kind === 'tomorrow') return 'neutral';
  return 'outline';
}
