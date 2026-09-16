import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFS,
  loadNotificationPrefs,
  saveNotificationPrefs,
  reminderTodayAt,
  shouldShowFocusReminder,
  markReminderShown,
} from './notificationPrefs';
import type { NotificationPrefs } from './notificationPrefs';

describe('loadNotificationPrefs', () => {
  it('returns defaults when nothing is stored', () => {
    const prefs = loadNotificationPrefs();
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });
});

describe('saveNotificationPrefs', () => {
  it('persists prefs that can be reloaded', () => {
    const prefs: NotificationPrefs = {
      dailySummary: true,
      focusReminder: true,
      reminderTime: '08:30',
    };
    const ok = saveNotificationPrefs(prefs);
    expect(ok).toBe(true);
    const loaded = loadNotificationPrefs();
    expect(loaded.focusReminder).toBe(true);
    expect(loaded.reminderTime).toBe('08:30');
  });

  it('falls back to defaults for invalid data', () => {
    saveNotificationPrefs({
      dailySummary: false,
      focusReminder: false,
      reminderTime: 'bad',
    });
    const loaded = loadNotificationPrefs();
    expect(loaded.reminderTime).toBe(DEFAULT_NOTIFICATION_PREFS.reminderTime);
  });
});

describe('reminderTodayAt', () => {
  it('returns epoch ms for a valid time on the given day', () => {
    const now = new Date(2026, 8, 15, 10, 30); // Sep 15 2026 10:30
    const at = reminderTodayAt({ reminderTime: '09:00' } as NotificationPrefs, now);
    expect(at).toBe(new Date(2026, 8, 15, 9, 0).getTime());
  });

  it('returns null for an invalid time', () => {
    const at = reminderTodayAt({ reminderTime: 'invalid' } as NotificationPrefs);
    expect(at).toBeNull();
  });
});

describe('shouldShowFocusReminder', () => {
  it('returns false when focusReminder is disabled', () => {
    const prefs: NotificationPrefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      focusReminder: false,
    };
    expect(shouldShowFocusReminder(prefs, new Date())).toBe(false);
  });

  it('returns false before the reminder time', () => {
    const now = new Date(2026, 8, 15, 8, 0);
    const prefs: NotificationPrefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      focusReminder: true,
      reminderTime: '09:00',
    };
    expect(shouldShowFocusReminder(prefs, now)).toBe(false);
  });

  it('returns true after the reminder time when not yet shown today', () => {
    const now = new Date(2026, 8, 15, 10, 0);
    const prefs: NotificationPrefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      focusReminder: true,
      reminderTime: '09:00',
    };
    expect(shouldShowFocusReminder(prefs, now)).toBe(true);
  });

  it('returns false after the reminder time when already shown today', () => {
    const now = new Date(2026, 8, 15, 10, 0); // Sep 15 2026 (month 8 = Sep)
    const prefs: NotificationPrefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      focusReminder: true,
      reminderTime: '09:00',
      lastReminderDay: '2026-9-15', // localDayKey for Sep 15 = "2026-9-15"
    };
    expect(shouldShowFocusReminder(prefs, now)).toBe(false);
  });
});

describe('markReminderShown', () => {
  it('stamps lastReminderDay to today', () => {
    const now = new Date(2026, 8, 15, 10, 0); // Sep 15 2026
    const prefs: NotificationPrefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      focusReminder: true,
      reminderTime: '09:00',
    };
    const marked = markReminderShown(prefs, now);
    expect(marked.lastReminderDay).toBe('2026-9-15');
  });

  it('preserves other fields', () => {
    const now = new Date(2026, 8, 15, 10, 0);
    const prefs: NotificationPrefs = {
      dailySummary: true,
      focusReminder: true,
      reminderTime: '08:15',
    };
    const marked = markReminderShown(prefs, now);
    expect(marked.dailySummary).toBe(true);
    expect(marked.reminderTime).toBe('08:15');
  });
});
