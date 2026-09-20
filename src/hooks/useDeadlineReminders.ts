import { useEffect } from 'react';
import type { Project } from '../lib/projects';
import {
  deadlinesDue,
  loadDeadlineReminders,
  saveDeadlineReminders,
  markDeadlineReminded,
  localDayKey,
} from '../lib/projects';
import { loadNotificationPrefs } from '../lib/notificationPrefs';
import { showNotification } from '../lib/store';

/**
 * Deadline reminders (Roadmap Faza 1.2): one browser notice per project
 * per day while the tab is open. Gated on Pro + user prefs.
 * Moved verbatim from App — behavior is unchanged.
 */
export function useDeadlineReminders(
  projects: Project[],
  notificationsEnabled: boolean,
  isPro: boolean,
): void {
  useEffect(() => {
    if (!isPro || !notificationsEnabled) return;
    if (!loadNotificationPrefs().deadlineReminders) return;
    const now = Date.now();
    const due = deadlinesDue(projects, now);
    if (due.length === 0) return;
    const dayKey = localDayKey(now);
    const reminded = loadDeadlineReminders();
    let next = reminded;
    for (const { project, msLeft } of due) {
      if (next[project.id] === dayKey) continue;
      const hours = Math.max(1, Math.round(msLeft / 3600000));
      showNotification(
        `Deadline approaching: ${project.name}`,
        `Due in ~${hours}h. Finish strong — open Moneo to plan the last push.`,
      );
      next = markDeadlineReminded(next, project.id, dayKey);
    }
    if (next !== reminded) saveDeadlineReminders(next);
  }, [projects, notificationsEnabled, isPro]);
}
