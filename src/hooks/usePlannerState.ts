import { useEffect, useRef, useState } from 'react';
import {
  loadPlans,
  carryForNewDay,
  planForDay,
  addTaskToDay,
  IVY_MAX_TASKS,
  IVY_FREE_MAX_TASKS,
} from '../lib/ivyLee';
import { dayKeyInTz } from '../lib/timezone';
import { dayCapacity } from '../lib/ritual';
import { loadRitualDay, saveRitualDay, shouldShowMorningRitual, nextDayKey } from '../lib/ritual';
import { weekdayOfKey, type TimeBlock } from '../lib/timeBlocks';
import type { FrogLog } from '../lib/frog';

/**
 * Daily planner state (Roadmap Faza 1.2): Ivy Lee plans with timezone
 * carry-over, morning/shutdown ritual visibility, tomorrow planning and
 * the Today-view load-vs-capacity numbers. Moved verbatim from App.
 */
export interface UsePlannerStateOptions {
  timezone: string;
  isPro: boolean;
  frogLog: FrogLog;
  timeBlocks: TimeBlock[];
  /** First-run onboarding is showing: day 0 gets no morning ritual. */
  firstRun?: boolean;
  /** Time-off days: the morning ritual does not open by itself. */
  timeOff?: string[];
}

export function usePlannerState({
  timezone,
  isPro,
  frogLog,
  timeBlocks,
  firstRun = false,
  timeOff = [],
}: UsePlannerStateOptions) {
  const timeOffRef = useRef(timeOff);
  const [ivyPlans, setIvyPlans] = useState(loadPlans);
  const [morningOpen, setMorningOpen] = useState(false);
  const [shutdownOpen, setShutdownOpen] = useState(false);

  // Ivy Lee carry-over: unfinished tasks roll into a fresh day's list once
  // the effective timezone is known.
  useEffect(() => {
    setIvyPlans((current) => {
      const { plans, changed } = carryForNewDay(current, timezone);
      return changed ? plans : current;
    });
  }, [timezone]);

  // Morning ritual: first open of the day, before noon, once. Never on the
  // first-run day — onboarding owns day 0; the ritual starts tomorrow.
  const autoRitualFired = useRef(false);
  const firstRunRef = useRef(firstRun);
  useEffect(() => {
    if (autoRitualFired.current) return;
    autoRitualFired.current = true;
    const now = Date.now();
    if (firstRunRef.current) {
      saveRitualDay(dayKeyInTz(now, timezone));
      return;
    }
    if (timeOffRef.current.includes(dayKeyInTz(now, timezone))) return;
    if (shouldShowMorningRitual(now, timezone, loadRitualDay())) {
      setMorningOpen(true);
    }
  }, [timezone]);

  // Shutdown ritual: carry selected unfinished items into tomorrow's plan.
  const moveToTomorrow = (texts: string[]) => {
    const max = isPro ? IVY_MAX_TASKS : IVY_FREE_MAX_TASKS;
    const key = nextDayKey(dayKeyInTz(Date.now(), timezone));
    let acc = ivyPlans;
    for (const text of texts) acc = addTaskToDay(acc, key, text, max).plans;
    setIvyPlans(acc);
  };

  // Today-view ritual data: estimated load vs real block capacity.
  const todayKey = dayKeyInTz(Date.now(), timezone);
  const todayEstimates = (planForDay(ivyPlans, todayKey)?.tasks ?? []).reduce(
    (sum, t) => sum + (t.estimateMin ?? 0),
    0,
  );
  const todayCapacity = dayCapacity(timeBlocks, weekdayOfKey(todayKey));
  const frogEaten = frogLog[todayKey]?.done === true;

  return {
    ivyPlans,
    setIvyPlans,
    morningOpen,
    setMorningOpen,
    shutdownOpen,
    setShutdownOpen,
    moveToTomorrow,
    todayKey,
    todayEstimates,
    todayCapacity,
    frogEaten,
  };
}
