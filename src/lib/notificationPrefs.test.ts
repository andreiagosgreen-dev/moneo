import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFS,
  loadNotificationPrefs,
  saveNotificationPrefs,
  reminderTodayAt,
  shouldShowFocusReminder,
  markReminderShown,
  shouldShowHabitReminder,
  markHabitShown,
  shouldShowDisconnectReminder,
  markDisconnectShown,
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
      deadlineReminders: true,
      habitReminders: false,
      habitTime: '20:00',
      disconnectReminders: false,
      disconnectTime: '18:00',
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
      deadlineReminders: true,
      habitReminders: true,
      habitTime: 'bad',
      disconnectReminders: true,
      disconnectTime: '25:00',
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
      deadlineReminders: false,
      habitReminders: true,
      habitTime: '20:00',
      disconnectReminders: true,
      disconnectTime: '18:00',
    };
    const marked = markReminderShown(prefs, now);
    expect(marked.dailySummary).toBe(true);
    expect(marked.reminderTime).toBe('08:15');
    expect(marked.deadlineReminders).toBe(false);
    expect(marked.habitReminders).toBe(true);
    expect(marked.disconnectTime).toBe('18:00');
  });
});

describe('deadlineReminders pref', () => {
  it('defaults to on', () => {
    expect(loadNotificationPrefs().deadlineReminders).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFS.deadlineReminders).toBe(true);
  });

  it('persists the toggle', () => {
    saveNotificationPrefs({ ...DEFAULT_NOTIFICATION_PREFS, deadlineReminders: false });
    expect(loadNotificationPrefs().deadlineReminders).toBe(false);
    saveNotificationPrefs({ ...DEFAULT_NOTIFICATION_PREFS, deadlineReminders: true });
    expect(loadNotificationPrefs().deadlineReminders).toBe(true);
  });
});

describe('habit + disconnect reminders', () => {
  it('defaults to off with evening times', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.habitReminders).toBe(false);
    expect(DEFAULT_NOTIFICATION_PREFS.habitTime).toBe('20:00');
    expect(DEFAULT_NOTIFICATION_PREFS.disconnectReminders).toBe(false);
    expect(DEFAULT_NOTIFICATION_PREFS.disconnectTime).toBe('18:00');
  });

  it('fires once per day after the set time', () => {
    const evening = new Date(2026, 8, 16, 21, 0);
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      habitReminders: true,
      disconnectReminders: true,
    };
    expect(shouldShowHabitReminder(prefs, evening)).toBe(true);
    expect(shouldShowDisconnectReminder(prefs, evening)).toBe(true);
    const marked = markDisconnectShown(markHabitShown(prefs, evening), evening);
    expect(shouldShowHabitReminder(marked, evening)).toBe(false);
    expect(shouldShowDisconnectReminder(marked, evening)).toBe(false);
  });

  it('stays quiet before the set time or when disabled', () => {
    const afternoon = new Date(2026, 8, 16, 15, 0);
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      habitReminders: true,
      disconnectReminders: true,
    };
    expect(shouldShowHabitReminder(prefs, afternoon)).toBe(false);
    expect(shouldShowDisconnectReminder(prefs, afternoon)).toBe(false);
    expect(shouldShowHabitReminder(DEFAULT_NOTIFICATION_PREFS, new Date(2026, 8, 16, 23, 0))).toBe(
      false,
    );
  });
});
