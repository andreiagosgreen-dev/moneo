import { useMemo, useState } from 'react';
import type { HabitFrequency } from '../../lib/habits';
import {
  FREE_HABITS_LIMIT,
  HABIT_TEMPLATES,
  activeHabits,
  createHabitObject,
  deleteHabit,
  habitStreak,
  habitSuccessRate,
  isHabitDue,
  toggleHabitDay,
  updateHabit,
  type HabitLog,
} from '../../lib/habits';
import { localDayKey } from '../../lib/projects';
import type { LifeCardProps } from './types';

export default function HabitsTab({
  habits,
  habitsChange,
  habitLog,
  habitLogChange,
  isPro = false,
}: LifeCardProps) {
  const [draft, setDraft] = useState('');
  const [freq, setFreq] = useState<HabitFrequency>('daily');
  const [showTemplates, setShowTemplates] = useState(false);
  const now = Date.now();
  const todayKey = localDayKey(now);
  const active = useMemo(() => activeHabits(habits), [habits]);
  const atCapacity = !isPro && active.length >= FREE_HABITS_LIMIT;

  const commitLog = (log: HabitLog) => habitLogChange(log);

  const add = (name: string, frequency: HabitFrequency, target = 3) => {
    if (atCapacity) return;
    const habit = createHabitObject(name, frequency, target);
    if (!habit) return;
    habitsChange([...habits, habit]);
    setDraft('');
    setShowTemplates(false);
  };

  return (
    <div>
      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] leading-relaxed text-faint">
          Small daily wins compound.
          <br />
          Start from a template below.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {active.map((h) => {
            const doneSet = new Set(habitLog[h.id] ?? []);
            const doneToday = doneSet.has(todayKey);
            const streak = isPro ? habitStreak(h, habitLog, now) : 0;
            const due = isHabitDue(h, habitLog, now);
            const rate = isPro ? habitSuccessRate(habitLog, h.id, now, 30) : null;
            const stackName = h.stackAfter ? habits.find((x) => x.id === h.stackAfter)?.name : null;
            return (
              <li
                key={h.id}
                className={`rounded-xl bg-ink/40 px-3.5 py-2.5 ring-1 ring-inset ring-line ${doneToday ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => commitLog(toggleHabitDay(habitLog, h.id, todayKey))}
                    className={`press flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${
                      doneToday
                        ? 'bg-accent text-on-accent ring-accent'
                        : 'bg-ink/60 text-transparent ring-line hover:text-sage'
                    }`}
                    aria-label={doneToday ? `Unmark ${h.name}` : `Complete ${h.name} today`}
                    aria-pressed={doneToday}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 12.5l5 5L20 6.5" />
                    </svg>
                  </button>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`truncate text-[13px] font-medium text-cream/90 ${doneToday ? 'line-through' : ''}`}
                    >
                      {h.name}
                    </span>
                    <span className="ml-2 font-mono text-[10px] text-faint">
                      {h.frequency === 'weekly' ? `${h.targetPerWeek}x/week` : 'daily'}
                      {stackName ? ` · after ${stackName}` : ''}
                      {!due && !doneToday ? ' · done for now' : ''}
                    </span>
                  </div>
                  {h.frequency === 'weekly' && (
                    <select
                      value={h.targetPerWeek}
                      onChange={(e) =>
                        habitsChange(
                          updateHabit(habits, h.id, { targetPerWeek: Number(e.target.value) }),
                        )
                      }
                      className="h-6 shrink-0 rounded bg-ink/60 px-1 font-mono text-[10px] text-faint ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                      title="Weekly target"
                      aria-label={`Weekly target for ${h.name}`}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          {n}x
                        </option>
                      ))}
                    </select>
                  )}
                  {isPro && streak > 1 && (
                    <span className="shrink-0 font-mono text-[11px] text-sage" title="Streak">
                      🔥{streak}
                    </span>
                  )}
                  {isPro && rate !== null && (
                    <span
                      className="shrink-0 font-mono text-[10px] text-faint"
                      title="30-day success rate"
                    >
                      {Math.round(rate * 100)}%
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Delete habit “${h.name}”? Its log goes too.`)) {
                        const { habits: nextH, log: nextL } = deleteHabit(habits, habitLog, h.id);
                        habitsChange(nextH);
                        commitLog(nextL);
                      }
                    }}
                    className="press shrink-0 rounded p-1 text-faint hover:text-tomato"
                    aria-label={`Delete ${h.name}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!atCapacity ? (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              maxLength={80}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && draft.trim() && add(draft, freq)}
              placeholder="e.g. Read 10 pages…"
              className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
            <select
              value={freq}
              onChange={(e) => setFreq(e.target.value as HabitFrequency)}
              className="h-9 shrink-0 rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              aria-label="Frequency"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <button
              onClick={() => draft.trim() && add(draft, freq)}
              disabled={!draft.trim()}
              className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
              aria-label="Add habit"
            >
              +
            </button>
          </div>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="press mt-2 font-mono text-[11px] text-sage hover:text-cream"
          >
            {showTemplates ? '▴ Hide templates' : '▾ Start from a template'}
          </button>
          {showTemplates && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {HABIT_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => add(t.name, t.frequency, t.targetPerWeek)}
                  className="press rounded-full px-3 py-1.5 font-mono text-[11px] text-sage ring-1 ring-inset ring-line hover:text-cream hover:ring-accent/50"
                >
                  + {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        !isPro && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
            <p className="text-[12px] leading-relaxed text-cream">
              Free plan tracks up to {FREE_HABITS_LIMIT} habits.
            </p>
            <p className="mt-1 font-mono text-[11px] text-faint">
              Upgrade to Pro for unlimited habits, streaks and success analytics.
            </p>
          </div>
        )
      )}
    </div>
  );
}
