import { useEffect } from 'react';
import type { Goal } from '../lib/goals';
import {
  capsulesDue,
  loadCapsuleDelivered,
  saveCapsuleDelivered,
  markCapsuleDelivered,
} from '../lib/goals';
import { showNotification } from '../lib/store';

export function useTimeCapsules(
  goals: Goal[],
  notificationsEnabled: boolean,
  isPro: boolean,
): void {
  useEffect(() => {
    if (!isPro || !notificationsEnabled) return;
    const now = Date.now();
    const delivered = loadCapsuleDelivered();
    const due = capsulesDue(goals, delivered, now);
    if (due.length === 0) return;
    let next = delivered;
    for (const goal of due) {
      showNotification(
        `Time capsule: ${goal.title}`,
        goal.capsuleNote ?? '',
      );
      next = markCapsuleDelivered(next, goal.id, now);
    }
    if (next !== delivered) saveCapsuleDelivered(next);
  }, [goals, notificationsEnabled, isPro]);
}
