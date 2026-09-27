import { useCallback, useEffect, useRef, useState } from 'react';
import type { Goal } from '../lib/goals';
import type { Project } from '../lib/projects';
import type { Session } from '../lib/store';
import type { Task } from '../lib/tasks';
import type { WaterfallPhase } from '../lib/waterfall';
import {
  loadCelebrationsShown,
  pendingCelebrations,
  saveCelebrationsShown,
  totalFocusDays,
} from '../lib/celebrations';
import {
  type Moment,
  celebrationMoment,
  detectWorkMoments,
  enqueueMoments,
  levelUpMoment,
  loadCelebratePrefs,
  markMomentShown,
  sessionMoment,
} from '../lib/moments';
import { levelUpCheck, loadLastSeenLevel, rankForLevel, saveLastSeenLevel } from '../lib/xp';

interface MomentSources {
  tasks: Task[];
  phases: WaterfallPhase[];
  projects: Project[];
  goals: Goal[];
  history: Session[];
  /** Current XP level (derived by the caller). */
  level: number;
}

/**
 * Queue of celebration moments. Work moments are detected by diffing
 * tasks/phases between renders (both are local-only, so a sync pull can
 * never fake one); sessions are pushed explicitly from the timer's
 * completion callback; goal / focus-day milestones and level-ups are
 * state-based and celebrate once. One moment on screen at a time.
 */
export function useMoments({ tasks, phases, projects, goals, history, level }: MomentSources) {
  const [queue, setQueue] = useState<Moment[]>([]);
  const prevRef = useRef({ tasks, phases });

  const push = useCallback((incoming: Moment[]) => {
    if (incoming.length === 0 || !loadCelebratePrefs().enabled) return;
    const shown = loadCelebrationsShown();
    setQueue((q) => enqueueMoments(q, incoming, shown));
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { tasks, phases };
    push(detectWorkMoments(prev, { tasks, phases }, projects));
  }, [tasks, phases, projects, push]);

  useEffect(() => {
    const shown = loadCelebrationsShown();
    const pending = pendingCelebrations(goals, tasks, totalFocusDays(history), shown);
    if (pending.length === 0) return;
    const moments = pending.map(celebrationMoment);
    if (loadCelebratePrefs().enabled) {
      push(moments);
      return;
    }
    // Turned off: count them as seen so they don't all pop up once re-enabled.
    saveCelebrationsShown(moments.reduce(markMomentShown, shown));
  }, [goals, tasks, history, push]);

  useEffect(() => {
    const lastSeen = loadLastSeenLevel();
    const check = levelUpCheck(level, lastSeen);
    if (check.seen !== lastSeen) saveLastSeenLevel(check.seen);
    if (check.celebrate !== null) {
      push([levelUpMoment(check.celebrate, rankForLevel(check.celebrate).isNewRank)]);
    }
  }, [level, push]);

  const celebrateSession = useCallback(
    (entry: Pick<Session, 'at' | 'min'>) => push([sessionMoment(entry)]),
    [push],
  );

  const dismiss = useCallback(() => {
    setQueue((q) => {
      const [current, ...rest] = q;
      if (current) saveCelebrationsShown(markMomentShown(loadCelebrationsShown(), current));
      return rest;
    });
  }, []);

  return { current: queue[0] ?? null, celebrateSession, dismiss };
}
