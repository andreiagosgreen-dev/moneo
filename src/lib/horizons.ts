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
