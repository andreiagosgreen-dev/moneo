import { dayKey, isToday, lastNDays, type Session } from './store';
import type { TKey } from './i18n/types';

/**
 * Moneo Growth — cumulative focused work creates persistent visible progress.
 *
 * Source of truth: the completed session history ONLY. Growth is fully
 * derived — no stored counters, no second state that could diverge.
 * Deterministic: identical history → identical growth.
 */

export interface GrowthStageDef {
  /** Internal semantic name (not prominent UI copy). */
  name: TKey;
  /** Cumulative focused minutes at which this stage begins. */
  min: number;
}

export const GROWTH_STAGES: GrowthStageDef[] = [
  { name: 'growth.stage.seed', min: 0 },
  { name: 'growth.stage.sprout', min: 60 },
  { name: 'growth.stage.leaf', min: 240 },
  { name: 'growth.stage.bloom', min: 600 },
];

/** Translation keys for stage names, in stage order (UI renders via t()). */
export const GROWTH_STAGE_KEYS: string[] = [
  'growth.stage.seed',
  'growth.stage.sprout',
  'growth.stage.leaf',
  'growth.stage.bloom',
];

export function getTotalFocusedMinutes(history: Session[]): number {
  return history.reduce((sum, s) => sum + Math.max(0, s.min), 0);
}

export function getGrowthStage(totalMinutes: number): number {
  let stage = 0;
  for (let i = 0; i < GROWTH_STAGES.length; i++) {
    if (totalMinutes >= GROWTH_STAGES[i].min) stage = i;
  }
  return stage;
}

/** 0..1 progress within the current stage (1 once at the final stage). */
export function getGrowthProgress(totalMinutes: number): number {
  const stage = getGrowthStage(totalMinutes);
  if (stage >= GROWTH_STAGES.length - 1) return 1;
  const lo = GROWTH_STAGES[stage].min;
  const hi = GROWTH_STAGES[stage + 1].min;
  return Math.min(1, Math.max(0, (totalMinutes - lo) / (hi - lo)));
}

export function getTodayFocusedMinutes(history: Session[]): number {
  return history.filter((s) => isToday(s.at)).reduce((sum, s) => sum + Math.max(0, s.min), 0);
}

export function getWeeklyFocusedMinutes(history: Session[]): number {
  const week = new Set(lastNDays(7).map((d) => dayKey(d)));
  return history
    .filter((s) => week.has(dayKey(new Date(s.at))))
    .reduce((sum, s) => sum + Math.max(0, s.min), 0);
}

export interface GrowthSummary {
  total: number;
  today: number;
  week: number;
  stage: number;
  stageName: TKey;
  progress: number;
}

export function getGrowthSummary(history: Session[]): GrowthSummary {
  const total = getTotalFocusedMinutes(history);
  const stage = getGrowthStage(total);
  return {
    total,
    today: getTodayFocusedMinutes(history),
    week: getWeeklyFocusedMinutes(history),
    stage,
    stageName: GROWTH_STAGES[stage].name,
    progress: getGrowthProgress(total),
  };
}
