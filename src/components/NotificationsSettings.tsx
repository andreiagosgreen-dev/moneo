import { useState } from "react";
import { useAuth } from "../lib/authProvider";

export default function NotificationsSettings() {
  const auth = useAuth();
  const [dailySummary, setDailySummary] = useState(false);
  const [focusReminder, setFocusReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // TODO: Save notification preferences to Supabase
    // In production, this would call an API to update user's notification settings
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaving(false);
  };

  if (!auth.user) {
    return (
      <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
        <p className="text-[12px] text-sage">
          Sign in to enable email notifications.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-ink/50 px-4 py-4">
      <h3 className="font-display text-[15px] font-bold text-cream">
        Email Notifications
      </h3>
      <p className="mt-1 text-[12px] leading-relaxed text-sage">
        Get helpful reminders and summaries to stay on track.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cream">
              Daily Summary
            </div>
            <div className="text-[11px] text-faint">
              Receive a daily summary of your focus sessions
            </div>
          </div>
          <button
            onClick={() => setDailySummary(!dailySummary)}
            className={`press h-6 w-11 rounded-full transition-colors ${
              dailySummary ? "bg-accent" : "bg-line/50"
            }`}
            aria-pressed={dailySummary}
          >
            <div
              className={`h-5 w-5 rounded-full bg-cream transition-transform ${
                dailySummary ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>

        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cream">
              Focus Reminder
            </div>
            <div className="text-[11px] text-faint">
              Get reminded to start your focus sessions
            </div>
          </div>
          <button
            onClick={() => setFocusReminder(!focusReminder)}
            className={`press h-6 w-11 rounded-full transition-colors ${
              focusReminder ? "bg-accent" : "bg-line/50"
            }`}
            aria-pressed={focusReminder}
          >
            <div
              className={`h-5 w-5 rounded-full bg-cream transition-transform ${
                focusReminder ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>

        {focusReminder && (
          <div>
            <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
              Reminder Time
            </label>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-line bg-ink/60 px-3 text-sm text-cream transition-colors focus:[border-color:var(--accent)] focus:outline-none"
            />
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="press btn-accent mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl font-display text-sm font-bold disabled:opacity-60"
      >
        {saving ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="animate-spin"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="2.5"
            />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        ) : null}
        Save Preferences
      </button>
    </div>
  );
}
