/**
 * Notification preferences — persisted locally.
 *
 * Email delivery itself lives server-side (see notifications/emailService).
 * These preferences power in-app reminder scheduling while the tab is open,
 * and are the payload a future Edge Function would consume for email.
 */

import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead, safeWrite } from './storage/storageAdapter';

export interface NotificationPrefs {
  dailySummary: boolean;
  focusReminder: boolean;
  reminderTime: string; // "HH:MM"
  /** Last day (local "YYYY-M-D") a focus reminder was shown — dedupe once/day. */
  lastReminderDay?: string;
  /** Deadline warnings for projects due within 48h (Roadmap 2.4). */
  deadlineReminders: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dailySummary: false,
  focusReminder: false,
  reminderTime: '09:00',
  deadlineReminders: true,
};

const PREFS_KEY = STORAGE_KEYS.notificationPrefs;

function isTimeValid(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

export function loadNotificationPrefs(): NotificationPrefs {
  const stored = safeRead<Partial<NotificationPrefs>>(PREFS_KEY);
  if (!stored) return { ...DEFAULT_NOTIFICATION_PREFS };
  return {
    dailySummary:
      typeof stored.dailySummary === 'boolean'
        ? stored.dailySummary
        : DEFAULT_NOTIFICATION_PREFS.dailySummary,
    focusReminder:
      typeof stored.focusReminder === 'boolean'
        ? stored.focusReminder
        : DEFAULT_NOTIFICATION_PREFS.focusReminder,
    reminderTime: isTimeValid(stored.reminderTime)
      ? stored.reminderTime
      : DEFAULT_NOTIFICATION_PREFS.reminderTime,
    ...(typeof stored.lastReminderDay === 'string'
      ? { lastReminderDay: stored.lastReminderDay }
      : {}),
    deadlineReminders:
      typeof stored.deadlineReminders === 'boolean'
        ? stored.deadlineReminders
        : DEFAULT_NOTIFICATION_PREFS.deadlineReminders,
  };
}

export function saveNotificationPrefs(prefs: NotificationPrefs): boolean {
  return safeWrite(PREFS_KEY, prefs);
}

/** Local day key ("YYYY-M-D") from a timestamp, matching dayKey() in store. */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Reminder "HH:MM" → today's epoch ms, or null when time is invalid. */
export function reminderTodayAt(prefs: NotificationPrefs, now = new Date()): number | null {
  if (!isTimeValid(prefs.reminderTime)) return null;
  const [hh, mm] = prefs.reminderTime.split(':').map(Number);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  return d.getTime();
}

/**
 * Should a focus reminder show now? Guards: enabled, reminder time passed
 * for today, and no reminder already shown today.
 */
export function shouldShowFocusReminder(prefs: NotificationPrefs, now = new Date()): boolean {
  if (!prefs.focusReminder) return false;
  const at = reminderTodayAt(prefs, now);
  if (at === null || now.getTime() < at) return false;
  return prefs.lastReminderDay !== localDayKey(now);
}

/** Mark the reminder as shown for today (returns updated prefs). */
export function markReminderShown(prefs: NotificationPrefs, now = new Date()): NotificationPrefs {
  return { ...prefs, lastReminderDay: localDayKey(now) };
}
