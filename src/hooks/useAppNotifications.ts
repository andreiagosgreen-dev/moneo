import { useEffect } from 'react';
import type { Project } from '../lib/projects';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  shouldShowFocusReminder,
  markReminderShown,
  shouldShowHabitReminder,
  markHabitShown,
  shouldShowDisconnectReminder,
  markDisconnectShown,
} from '../lib/notificationPrefs';
import { showNotification, requestNotificationPermission } from '../lib/store';
import { useDeadlineReminders } from './useDeadlineReminders';
import type { Translate } from './useTimer';

export interface AppNotificationsOptions {
  projects: Project[];
  notificationsEnabled: boolean;
  isPro: boolean;
  t: Translate;
}

/**
 * All in-app notification side effects in one place (moved verbatim from App):
 * permission request, deadline reminders, and the 30s reminder loop
 * (focus for everyone; habit + disconnect nudges are Pro).
 */
export function useAppNotifications({
  projects,
  notificationsEnabled,
  isPro,
  t,
}: AppNotificationsOptions): void {
  useDeadlineReminders(projects, notificationsEnabled, isPro, t);

  // Request notification permission when notifications are enabled
  useEffect(() => {
    if (notificationsEnabled) {
      requestNotificationPermission();
    }
  }, [notificationsEnabled]);

  // In-app reminders: check every 30s while the tab is open. Focus reminders
  // work for everyone; habit + disconnect nudges are Pro notifications.
  useEffect(() => {
    const check = () => {
      let prefs = loadNotificationPrefs();
      if (shouldShowFocusReminder(prefs)) {
        prefs = markReminderShown(prefs);
        saveNotificationPrefs(prefs);
        showNotification(t('notif.push.focusT'), t('notif.push.focusB'));
      }
      if (isPro && shouldShowHabitReminder(prefs)) {
        prefs = markHabitShown(prefs);
        saveNotificationPrefs(prefs);
        showNotification(t('notif.push.habitT'), t('notif.push.habitB'));
      }
      if (isPro && shouldShowDisconnectReminder(prefs)) {
        prefs = markDisconnectShown(prefs);
        saveNotificationPrefs(prefs);
        showNotification(t('notif.push.discT'), t('notif.push.discB'));
      }
    };
    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, [isPro, t]);
}
