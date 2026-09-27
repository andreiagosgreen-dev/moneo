import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from '../lib/projects';
import type { Session } from '../lib/store';
import type { Task } from '../lib/tasks';
import type { WaterfallPhase } from '../lib/waterfall';
import { loadCelebrationsShown, saveCelebrationsShown } from '../lib/celebrations';
import {
  type Moment,
  detectWorkMoments,
  enqueueMoments,
  loadCelebratePrefs,
  markMomentShown,
  sessionMoment,
} from '../lib/moments';

/**
 * Queue of everyday celebration moments. Work moments are detected by
 * diffing tasks/phases between renders (both are local-only, so a sync pull
 * can never fake one); sessions are pushed explicitly from the timer's
 * completion callback. One moment on screen at a time.
 */
export function useMoments(tasks: Task[], phases: WaterfallPhase[], projects: Project[]) {
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
