import { useState } from 'react';
import { useAuth } from '../lib/authProvider';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '../lib/notificationPrefs';
import { requestNotificationPermission, showNotification } from '../lib/store';
import { isEmailConfigured } from '../lib/notifications/emailService';
import { useI18n } from '../lib/i18n/LocaleContext';

export default function NotificationsSettings() {
  const { t } = useI18n();
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
      showNotification(t('notif.test.on'), t('notif.test.body'));
    }
  };

  if (!auth.user) {
    return (
      <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
        <p className="text-[12px] text-sage">{t('notif.signin')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-ink/50 px-4 py-4">
      <h3 className="font-display text-[15px] font-bold text-cream">{t('notif.title')}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-sage">{t('notif.sub')}</p>

      <div className="mt-4 space-y-3">
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cream">{t('notif.daily')}</div>
            <div className="text-[11px] text-faint">{t('notif.dailyBody')}</div>
            {!isEmailConfigured() && (
              <div className="mt-1 text-[11px] text-faint">{t('notif.noMail')}</div>
            )}
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
            <div className="text-sm font-semibold text-cream">{t('notif.focus')}</div>
            <div className="text-[11px] text-faint">{t('notif.focusBody')}</div>
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
              {t('notif.time')}
            </label>
            <input
              type="time"
              value={prefs.reminderTime}
              onChange={(e) => update({ reminderTime: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-line bg-ink/60 px-3 text-sm text-cream transition-colors focus:[border-color:var(--accent)] focus:outline-none"
            />
          </div>
        )}

        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cream">{t('notif.habit')}</div>
            <div className="text-[11px] text-faint">{t('notif.habitBody')}</div>
          </div>
          <button
            onClick={() => update({ habitReminders: !prefs.habitReminders })}
            className={`press h-6 w-11 rounded-full transition-colors ${
              prefs.habitReminders ? 'bg-accent' : 'bg-line/50'
            }`}
            aria-pressed={prefs.habitReminders}
          >
            <div
              className={`h-5 w-5 rounded-full bg-cream transition-transform ${
                prefs.habitReminders ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>

        {prefs.habitReminders && (
          <div>
            <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
              {t('notif.habitTime')}
            </label>
            <input
              type="time"
              value={prefs.habitTime}
              onChange={(e) => update({ habitTime: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-line bg-ink/60 px-3 text-sm text-cream transition-colors focus:[border-color:var(--accent)] focus:outline-none"
            />
          </div>
        )}

        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cream">{t('notif.disconnect')}</div>
            <div className="text-[11px] text-faint">{t('notif.disconnectBody')}</div>
          </div>
          <button
            onClick={() => update({ disconnectReminders: !prefs.disconnectReminders })}
            className={`press h-6 w-11 rounded-full transition-colors ${
              prefs.disconnectReminders ? 'bg-accent' : 'bg-line/50'
            }`}
            aria-pressed={prefs.disconnectReminders}
          >
            <div
              className={`h-5 w-5 rounded-full bg-cream transition-transform ${
                prefs.disconnectReminders ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>

        {prefs.disconnectReminders && (
          <div>
            <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
              {t('notif.disconnectTime')}
            </label>
            <input
              type="time"
              value={prefs.disconnectTime}
              onChange={(e) => update({ disconnectTime: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-line bg-ink/60 px-3 text-sm text-cream transition-colors focus:[border-color:var(--accent)] focus:outline-none"
            />
          </div>
        )}
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cream">{t('notif.deadline')}</div>
            <div className="text-[11px] text-faint">{t('notif.deadlineBody')}</div>
          </div>
          <button
            onClick={() => update({ deadlineReminders: !prefs.deadlineReminders })}
            className={`press h-6 w-11 rounded-full transition-colors ${
              prefs.deadlineReminders ? 'bg-accent' : 'bg-line/50'
            }`}
            aria-pressed={prefs.deadlineReminders}
          >
            <div
              className={`h-5 w-5 rounded-full bg-cream transition-transform ${
                prefs.deadlineReminders ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cream">
              {t('notif.sessionReflection.label')}
            </div>
            <div className="text-[11px] text-faint">{t('notif.sessionReflection.desc')}</div>
          </div>
          <button
            onClick={() => update({ sessionReflection: !prefs.sessionReflection })}
            className={`press h-6 w-11 rounded-full transition-colors ${
              prefs.sessionReflection ? 'bg-accent' : 'bg-line/50'
            }`}
            aria-pressed={prefs.sessionReflection}
          >
            <div
              className={`h-5 w-5 rounded-full bg-cream transition-transform ${
                prefs.sessionReflection ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
      </div>

      {savedFlash && <p className="mt-3 text-[12px] font-medium text-sage">{t('notif.saved')}</p>}
    </div>
  );
}
