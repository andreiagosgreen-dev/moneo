import { useEffect } from 'react';
import { requestNotificationPermission, showNotification } from '../lib/store';
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

/**
 * Browser notification permission + in-app reminder polling (30s while the
 * tab is open). Focus reminders work for everyone; habit + disconnect
 * nudges are Pro. Moved verbatim from App — behavior is unchanged.
 */
export function useAppNotifications(notificationsEnabled: boolean, isPro: boolean): void {
  useEffect(() => {
    if (notificationsEnabled) requestNotificationPermission();
  }, [notificationsEnabled]);

  useEffect(() => {
    const check = () => {
      let prefs = loadNotificationPrefs();
      if (shouldShowFocusReminder(prefs)) {
        prefs = markReminderShown(prefs);
        saveNotificationPrefs(prefs);
        showNotification('Time to focus', 'Your focus reminder is due. Start a round!');
      }
      if (isPro && shouldShowHabitReminder(prefs)) {
        prefs = markHabitShown(prefs);
        saveNotificationPrefs(prefs);
        showNotification('Habits check-in', "Close out today's habits before bed.");
      }
      if (isPro && shouldShowDisconnectReminder(prefs)) {
        prefs = markDisconnectShown(prefs);
        saveNotificationPrefs(prefs);
        showNotification('Time to disconnect', 'Work is done — rest is productive too.');
      }
    };
    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, [isPro]);
}
