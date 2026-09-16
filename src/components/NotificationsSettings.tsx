import { useState } from 'react';
import { useAuth } from '../lib/authProvider';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '../lib/notificationPrefs';
import { requestNotificationPermission, showNotification } from '../lib/store';

export default function NotificationsSettings() {
  const auth = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadNotificationPrefs);
  const [savedFlash, setSavedFlash] = useState(false);

  const update = (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveNotificationPrefs(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  const enableReminders = async () => {
    const perm = await requestNotificationPermission();
    if (perm === 'granted' && prefs.focusReminder) {
      showNotification('Focus reminder on', "You'll get a nudge to start your next focus round.");
    }
  };

  if (!auth.user) {
    return (
      <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
        <p className="text-[12px] text-sage">
          Sign in to enable email notifications. In-app focus reminders work without an account too.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-ink/50 px-4 py-4">
      <h3 className="font-display text-[15px] font-bold text-cream">Notifications</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-sage">
        Stay on track with browser reminders and email summaries.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cream">Daily Summary</div>
            <div className="text-[11px] text-faint">
              Receive a daily summary of your focus sessions
            </div>
          </div>
          <button
            onClick={() => update({ dailySummary: !prefs.dailySummary })}
            className={`press h-6 w-11 rounded-full transition-colors ${
              prefs.dailySummary ? 'bg-accent' : 'bg-line/50'
            }`}
            aria-pressed={prefs.dailySummary}
          >
            <div
              className={`h-5 w-5 rounded-full bg-cream transition-transform ${
                prefs.dailySummary ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>

        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cream">Focus Reminder</div>
            <div className="text-[11px] text-faint">
              Browser reminder at a set time to start focusing
            </div>
          </div>
          <button
            onClick={() => {
              update({ focusReminder: !prefs.focusReminder });
              void enableReminders();
            }}
            className={`press h-6 w-11 rounded-full transition-colors ${
              prefs.focusReminder ? 'bg-accent' : 'bg-line/50'
            }`}
            aria-pressed={prefs.focusReminder}
          >
            <div
              className={`h-5 w-5 rounded-full bg-cream transition-transform ${
                prefs.focusReminder ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>

        {prefs.focusReminder && (
          <div>
            <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
              Reminder Time
            </label>
            <input
              type="time"
              value={prefs.reminderTime}
              onChange={(e) => update({ reminderTime: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-line bg-ink/60 px-3 text-sm text-cream transition-colors focus:[border-color:var(--accent)] focus:outline-none"
            />
          </div>
        )}
      </div>

      {savedFlash && (
        <p className="mt-3 text-[12px] font-medium text-sage">Preferences saved on this device.</p>
      )}
    </div>
  );
}
