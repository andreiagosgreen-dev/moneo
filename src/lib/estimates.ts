/* Estimate vs. actual focused minutes, per task and overall. */
import type { Session } from './store';
import type { Task } from './tasks';

/** actual < 80 % | within ±20 % | > 120 % of the estimate. */
export type EstimateVerdict = 'under' | 'on' | 'over';

export interface EstimateResult {
  estimateMin: number;
  actualMin: number;
  /** actual / estimate */
  ratio: number;
  verdict: EstimateVerdict;
}

export function verdictFor(ratio: number): EstimateVerdict {
  if (ratio < 0.8) return 'under';
  if (ratio > 1.2) return 'over';
  return 'on';
}

/** null when there is no estimate or nothing was tracked yet. */
export function estimateVsActual(
  estimateMin: number | undefined,
  actualMin: number,
): EstimateResult | null {
  if (typeof estimateMin !== 'number' || !(estimateMin > 0) || !(actualMin > 0)) return null;
  const ratio = actualMin / estimateMin;
  return { estimateMin, actualMin, ratio, verdict: verdictFor(ratio) };
}

export const MIN_ACCURACY_TASKS = 3;

/** Completed tasks with an estimate and ≥1 session; null when fewer than 3. */
export function estimateAccuracy(
  tasks: Task[],
  history: Session[],
): { total: number; onTarget: number; pct: number } | null {
  const byTask = new Map<string, number>();
  for (const s of history) if (s.taskId) byTask.set(s.taskId, (byTask.get(s.taskId) ?? 0) + s.min);
  let total = 0;
  let onTarget = 0;
  for (const t of tasks) {
    if (t.status !== 'completed') continue;
    const r = estimateVsActual(t.estimateMin, byTask.get(t.id) ?? 0);
    if (!r) continue;
    total++;
    if (r.verdict === 'on') onTarget++;
  }
  if (total < MIN_ACCURACY_TASKS) return null;
  return { total, onTarget, pct: Math.round((onTarget / total) * 100) };
}
