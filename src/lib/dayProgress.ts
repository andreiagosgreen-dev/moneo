import type { IvyPlan } from './ivyLee';
import type { Session } from './store';
import { dayKeyInTz } from './timezone';

export interface DayProgress {
  done: number;
  total: number;
  pct: number;
  focusMin: number;
  focusSessions: number;
}

/** Plan completion and focus activity for one calendar day. */
export function dayProgress(
  plan: IvyPlan | null,
  history: Session[],
  todayKey: string,
  timezone: string,
): DayProgress {
  const total = plan?.tasks.length ?? 0;
  const done = plan?.tasks.filter((x) => x.done).length ?? 0;
  let focusMin = 0;
  let focusSessions = 0;
  for (const session of history) {
    if (dayKeyInTz(session.at, timezone) !== todayKey) continue;
    focusMin += session.min;
    focusSessions++;
  }
  return {
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    focusMin,
    focusSessions,
  };
}
