import type { IvyPlan } from './ivyLee';
import type { Session } from './store';
import { dayKeyInTz } from './timezone';

export interface DayProgress {
  done: number;
  total: number;
  pct: number;
  focusMin: number;
}

/** Numbers behind the Today ring: plan completion and focus minutes of the day. */
export function dayProgress(
  plan: IvyPlan | null,
  history: Session[],
  todayKey: string,
  timezone: string,
): DayProgress {
  const total = plan?.tasks.length ?? 0;
  const done = plan?.tasks.filter((x) => x.done).length ?? 0;
  const focusMin = history.reduce(
    (sum, s) => (dayKeyInTz(s.at, timezone) === todayKey ? sum + s.min : sum),
    0,
  );
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, focusMin };
}
