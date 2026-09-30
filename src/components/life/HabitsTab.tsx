import { useMemo, useState } from 'react';
import type { HabitFrequency } from '../../lib/habits';
import {
  FREE_HABITS_LIMIT,
  HABIT_TEMPLATES,
  activeHabits,
  canFreeze,
  createHabitObject,
  deleteHabit,
  freezeYesterday,
  habitStreak,
  habitSuccessRate,
  isHabitDue,
  skipSetFor,
  toggleHabitDay,
  updateHabit,
  type HabitLog,
} from '../../lib/habits';
import { localDayKey } from '../../lib/projects';
import { addDays } from '../../lib/dayKeys';
import type { LifeCardProps } from './types';
import { useI18n } from '../../lib/i18n/LocaleContext';
import type { TKey } from '../../lib/i18n/types';
import MonoFlame from '../../mono/MonoFlame';
import MonoIconPicker from '../../mono/MonoIconPicker';
import MonoVacation from '../../mono/MonoVacation';

/** Template name → translation key (created habits carry the shown name). */
const TEMPLATE_KEYS: Record<string, TKey> = {
  'Morning pages': 'life.tpl.habit.pages',
  'Exercise 20 min': 'life.tpl.habit.exercise',
  'Read 10 pages': 'life.tpl.habit.read',
  'Meditate 10 min': 'life.tpl.habit.meditate',
  'Inbox zero': 'life.tpl.habit.inbox',
  'Strength training': 'life.tpl.habit.strength',
  'Weekly review': 'life.tpl.habit.review',
  'Call family': 'life.tpl.habit.family',
};

export default function HabitsTab({
  habits,
  habitsChange,
  habitLog,
  habitLogChange,
  timeOff,
  timeOffChange,
  isPro = false,
}: LifeCardProps) {
  const [draft, setDraft] = useState('');
  const [draftIcon, setDraftIcon] = useState<string | undefined>(undefined);
  const [freq, setFreq] = useState<HabitFrequency>('daily');
  const [showTemplates, setShowTemplates] = useState(false);
  const { t, tp, fmtNum } = useI18n();
  const now = Date.now();
  const todayKey = localDayKey(now);
  const yesterdayKey = addDays(todayKey, -1);
  const active = useMemo(() => activeHabits(habits), [habits]);
  const atCapacity = !isPro && active.length >= FREE_HABITS_LIMIT;

  const commitLog = (log: HabitLog) => habitLogChange(log);

  const add = (name: string, frequency: HabitFrequency, target = 3, icon?: string) => {
    if (atCapacity) return;
    const habit = createHabitObject(name, frequency, target, icon);
    if (!habit) return;
    habitsChange([...habits, habit]);
    setDraft('');
    setDraftIcon(undefined);
    setShowTemplates(false);
  };

  return (
    <div>
      {active.length === 0 ? (
        <div className="empty-panel">
          <p>
            {t('life.hab.emptyA')}
            <br />
            {t('life.hab.emptyB')}
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {active.map((h) => {
            const doneSet = new Set(habitLog[h.id] ?? []);
            const doneToday = doneSet.has(todayKey);
            const streak = habitStreak(h, habitLog, now, { skip: skipSetFor(h, timeOff) });
            const freezable = canFreeze(h, habitLog, timeOff, now);
            const frozenYesterday = (h.frozen ?? []).includes(yesterdayKey);
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
                    aria-label={t(doneToday ? 'life.hab.undo' : 'life.hab.do', { name: h.name })}
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
                  <MonoIconPicker
                    value={h.icon}
                    onChange={(icon) => habitsChange(updateHabit(habits, h.id, { icon }))}
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] font-medium text-cream/90 ${doneToday ? 'line-through' : ''}`}
                    >
                      {h.name}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-faint">
                      {h.frequency === 'weekly'
                        ? t('life.hab.perWeek', { n: fmtNum(h.targetPerWeek) })
                        : t('life.hab.daily')}
                      {stackName ? ` · ${t('life.hab.after', { name: stackName })}` : ''}
                      {!due && !doneToday ? ` · ${t('life.hab.paused')}` : ''}
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
                      title={t('life.hab.target')}
                      aria-label={t('life.hab.targetAria', { name: h.name })}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          {n}x
                        </option>
                      ))}
                    </select>
                  )}
                  {streak > 1 && (
                    <span className="mono-streak shrink-0 font-mono text-[11px]">
                      <MonoFlame />
                      <span aria-hidden>{fmtNum(streak)}</span>
                      <span className="sr-only">{tp('mono.habits.streak', streak)}</span>
                    </span>
                  )}
                  {freezable && (
                    <button
                      type="button"
                      onClick={() => habitsChange(freezeYesterday(habits, h.id, now))}
                      className="press shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium text-sage ring-1 ring-inset ring-line hover:text-cream"
                      title={t('mono.habits.freezeHint')}
                    >
                      {t('mono.habits.freeze')}
                    </button>
                  )}
                  {!freezable && frozenYesterday && (
                    <span className="shrink-0 font-mono text-[10px] text-sage">
                      {t('mono.habits.frozen')}
                    </span>
                  )}
                  {isPro && rate !== null && (
                    <span
                      className="shrink-0 font-mono text-[10px] text-faint"
                      title={t('life.hab.rate')}
                    >
                      {Math.round(rate * 100)}%
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(t('life.hab.confirm', { name: h.name }))) {
                        const { habits: nextH, log: nextL } = deleteHabit(habits, habitLog, h.id);
                        habitsChange(nextH);
                        commitLog(nextL);
                      }
                    }}
                    className="press shrink-0 rounded p-1 text-faint hover:text-tomato"
                    aria-label={t('life.hab.del', { name: h.name })}
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
          <div className="flex flex-wrap items-center gap-2">
            <MonoIconPicker
              value={draftIcon}
              onChange={(icon) => setDraftIcon(icon ?? undefined)}
            />
            <input
              type="text"
              value={draft}
              maxLength={80}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && draft.trim() && add(draft, freq, 3, draftIcon)}
              placeholder={t('life.hab.ph')}
              aria-label={t('life.hab.add')}
              className="mono-ph-fit h-10 min-w-[10rem] flex-1 rounded-lg bg-ink/40 px-3 text-[14px] text-cream ring-1 ring-inset ring-line placeholder:text-sage/70 focus:ring-accent focus:outline-none"
            />
            <select
              value={freq}
              onChange={(e) => setFreq(e.target.value as HabitFrequency)}
              className="h-10 shrink-0 rounded-lg bg-ink/40 px-2.5 text-[13px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              aria-label={t('life.hab.freq')}
            >
              <option value="daily">{t('life.hab.dailyOpt')}</option>
              <option value="weekly">{t('life.hab.weeklyOpt')}</option>
            </select>
            <button
              onClick={() => draft.trim() && add(draft, freq, 3, draftIcon)}
              disabled={!draft.trim()}
              className="press btn-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
              aria-label={t('life.hab.add')}
            >
              +
            </button>
          </div>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="press mt-2 text-[13px] font-medium text-sage hover:text-cream"
          >
            {t(showTemplates ? 'life.hab.hideTpl' : 'life.hab.showTpl')}
          </button>
          {showTemplates && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {HABIT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  onClick={() =>
                    add(
                      t(TEMPLATE_KEYS[tpl.name] ?? 'life.hab.add'),
                      tpl.frequency,
                      tpl.targetPerWeek,
                    )
                  }
                  className="press rounded-full px-3 py-1.5 font-mono text-[11px] text-sage ring-1 ring-inset ring-line hover:text-cream hover:ring-accent/50"
                >
                  + {t(TEMPLATE_KEYS[tpl.name] ?? 'life.hab.add')}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        !isPro && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
            <p className="text-[12px] leading-relaxed text-cream">
              {t('life.hab.cap', { n: FREE_HABITS_LIMIT })}
            </p>
            <p className="mt-1 font-mono text-[11px] text-faint">{t('life.hab.capBody')}</p>
          </div>
        )
      )}
      <div className="mono mt-5" style={{ background: 'transparent', color: 'inherit' }}>
        <MonoVacation timeOff={timeOff} onChange={timeOffChange} todayKey={todayKey} />
      </div>
    </div>
  );
}
