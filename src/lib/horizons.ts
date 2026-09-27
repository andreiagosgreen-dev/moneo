/**
 * Coherent planning horizons across Goals, AI path and assistant.
 *
 * Near term (day / week / month) already exists in Today / Ivy / Calendar.
 * Long arc: 1y · 3y · 5y · 7y · 10y · life — one vocabulary the UI and engines share.
 * Pure + tested; never throws.
 */
import type { GoalLevel } from './goals';

export type PlanningHorizon =
  'day' | 'week' | 'month' | 'year1' | 'year3' | 'year5' | 'year7' | 'year10' | 'life';

/** UI order: near → far. */
export const PLANNING_HORIZONS: PlanningHorizon[] = [
  'day',
  'week',
  'month',
  'year1',
  'year3',
  'year5',
  'year7',
  'year10',
  'life',
];

/** Long-arc chips shown on Goals / Plan (day lives in Today). */
export const GOAL_HORIZONS: PlanningHorizon[] = [
  'week',
  'month',
  'year1',
  'year3',
  'year5',
  'year7',
  'year10',
  'life',
];

/** AI path horizon pickers (months). Life ≈ 40y planning window. */
export const AI_HORIZON_MONTHS = [1, 3, 6, 12, 36, 60, 84, 120, 480] as const;

export const HORIZON_LABEL_KEYS: Record<PlanningHorizon, string> = {
  day: 'horizon.day',
  week: 'horizon.week',
  month: 'horizon.month',
  year1: 'horizon.year1',
  year3: 'horizon.year3',
  year5: 'horizon.year5',
  year7: 'horizon.year7',
  year10: 'horizon.year10',
  life: 'horizon.life',
};

export const HORIZON_SHORT_KEYS: Record<PlanningHorizon, string> = {
  day: 'horizon.short.day',
  week: 'horizon.short.week',
  month: 'horizon.short.month',
  year1: 'horizon.short.year1',
  year3: 'horizon.short.year3',
  year5: 'horizon.short.year5',
  year7: 'horizon.short.year7',
  year10: 'horizon.short.year10',
  life: 'horizon.short.life',
};

/** Approximate months for capacity / AI engines. Life is a deliberate long window. */
export function horizonToMonths(h: PlanningHorizon): number {
  switch (h) {
    case 'day':
      return 0;
    case 'week':
      return 0;
    case 'month':
      return 1;
    case 'year1':
      return 12;
    case 'year3':
      return 36;
    case 'year5':
      return 60;
    case 'year7':
      return 84;
    case 'year10':
      return 120;
    case 'life':
      return 480;
  }
}

/** Map a horizon onto the goal hierarchy level. */
export function horizonToGoalLevel(h: PlanningHorizon): GoalLevel {
  switch (h) {
    case 'day':
      return 'daily';
    case 'week':
      return 'weekly';
    case 'month':
      return 'project';
    case 'year1':
      return 'vision';
    case 'year3':
      return 'years3';
    case 'year5':
      return 'years5';
    case 'year7':
      return 'years7';
    case 'year10':
      return 'years10';
    case 'life':
      return 'life';
  }
}

export function goalLevelToHorizon(level: GoalLevel): PlanningHorizon {
  switch (level) {
    case 'daily':
      return 'day';
    case 'weekly':
      return 'week';
    case 'project':
      return 'month';
    case 'milestone':
      return 'month';
    case 'vision':
      return 'year1';
    case 'years3':
      return 'year3';
    case 'years5':
      return 'year5';
    case 'years7':
      return 'year7';
    case 'years10':
      return 'year10';
    case 'life':
      return 'life';
  }
}

/** Clamp months for engines (local + worker). Life window included. */
export function clampHorizonMonths(months: number): number {
  if (!Number.isFinite(months)) return 6;
  return Math.min(480, Math.max(1, Math.round(months)));
}

/** Best matching horizon chip for a month count (AI answers → UI). */
export function monthsToHorizon(months: number): PlanningHorizon {
  const m = clampHorizonMonths(months);
  if (m <= 6) return 'month';
  if (m <= 18) return 'year1';
  if (m <= 42) return 'year3';
  if (m <= 66) return 'year5';
  if (m <= 96) return 'year7';
  if (m <= 180) return 'year10';
  return 'life';
}
