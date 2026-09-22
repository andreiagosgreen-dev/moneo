import { useEffect, useState } from 'react';
import type { Goal } from '../lib/goals';
import type { Task } from '../lib/tasks';
import type { Session } from '../lib/store';
import {
  type Celebration,
  loadCelebrationsShown,
  markCelebrationShown,
  pendingCelebrations,
  saveCelebrationsShown,
  totalFocusDays,
} from '../lib/celebrations';

/**
 * One celebration at a time (Faza 27). Detects newly-earned celebrations
 * whenever goals/tasks/history change and queues them; the caller pops the
 * front with `dismiss()` once shown, which persists it to the shown-log.
 */
export function useCelebrations(goals: Goal[], tasks: Task[], history: Session[]) {
  const [queue, setQueue] = useState<Celebration[]>([]);

  useEffect(() => {
    const shown = loadCelebrationsShown();
    const pending = pendingCelebrations(goals, tasks, totalFocusDays(history), shown);
    if (pending.length === 0) return;
    setQueue((q) => {
      const known = new Set(q.map((c) => c.id));
      const fresh = pending.filter((c) => !known.has(c.id));
      return fresh.length > 0 ? [...q, ...fresh] : q;
    });
  }, [goals, tasks, history]);

  const dismiss = () => {
    setQueue((q) => {
      const [current, ...rest] = q;
      if (current) saveCelebrationsShown(markCelebrationShown(loadCelebrationsShown(), current.id));
      return rest;
    });
  };

  return { current: queue[0] ?? null, dismiss };
}
