import { useMemo, useState } from 'react';
import MonoCard from './MonoCard';
import MonoTick from './MonoTick';
import MonoBtn from './MonoBtn';
import MonoChip from './MonoChip';
import MonoHabitMonth from './MonoHabitMonth';
import { activeHabits, isHabitDue, toggleHabitDay, type Habit, type HabitLog } from '../lib/habits';
import { localDayKey } from '../lib/projects';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  habits: Habit[];
  habitLog: HabitLog;
  onHabitLogChange: (log: HabitLog) => void;
  /** Open full Life / habits management (under More today). */
  onManage?: () => void;
  now?: number;
}

/** Short Mono habit check-in for Today — toggle only, no streaks/CRUD. */
export default function MonoHabitsCheckin({
  habits,
  habitLog,
  onHabitLogChange,
  onManage,
  now = Date.now(),
}: Props) {
  const { t, fmtNum } = useI18n();
  const todayKey = localDayKey(now);
  const active = useMemo(() => activeHabits(habits), [habits]);
  const [view, setView] = useState<'today' | 'month'>('today');

  const doneToday = active.filter((h) => (habitLog[h.id] ?? []).includes(todayKey)).length;
  const total = active.length;

  return (
    <section className="mono-sec mono-pad" aria-label={t('mono.azi.habits')}>
      <div className="mono-between" style={{ marginBottom: 8 }}>
        <p className="mono-eyebrow" style={{ marginBottom: 0 }}>
          {t('mono.azi.habits')}
        </p>
        {total > 0 ? (
          <span className="mono-meta">
            {t('mono.azi.habitsCount', { done: fmtNum(doneToday), total: fmtNum(total) })}
          </span>
        ) : null}
      </div>

      {total === 0 ? (
        <MonoCard>
          <p className="mono-meta">{t('mono.azi.habitsEmpty')}</p>
          {onManage ? (
            <div style={{ marginTop: 12 }}>
              <MonoBtn variant="ghost" onClick={onManage} block>
                {t('mono.azi.habitsManage')}
              </MonoBtn>
            </div>
          ) : null}
        </MonoCard>
      ) : (
        <>
          <div
            className="mono-row mono-hgrid-switch"
            role="group"
            aria-label={t('mono.habits.viewAria')}
          >
            <MonoChip type="button" pressed={view === 'today'} onClick={() => setView('today')}>
              {t('mono.habits.viewToday')}
            </MonoChip>
            <MonoChip type="button" pressed={view === 'month'} onClick={() => setView('month')}>
              {t('mono.habits.viewMonth')}
            </MonoChip>
          </div>
          {view === 'month' ? (
            <MonoHabitMonth
              habits={habits}
              habitLog={habitLog}
              onHabitLogChange={onHabitLogChange}
              now={now}
            />
          ) : (
            <MonoCard style={{ padding: '8px 16px' }}>
              {active.map((h) => {
                const doneSet = new Set(habitLog[h.id] ?? []);
                const checked = doneSet.has(todayKey);
                const due = isHabitDue(h, habitLog, now);
                const metaParts: string[] = [
                  h.frequency === 'weekly'
                    ? t('life.hab.perWeek', { n: fmtNum(h.targetPerWeek) })
                    : t('life.hab.daily'),
                ];
                if (!due && !checked) metaParts.push(t('life.hab.paused'));

                return (
                  <div key={h.id} className="mono-list-row">
                    <MonoTick
                      checked={checked}
                      onToggle={() => onHabitLogChange(toggleHabitDay(habitLog, h.id, todayKey))}
                      label={t(checked ? 'life.hab.undo' : 'life.hab.do', { name: h.name })}
                    />
                    <div className="mono-list-grow">
                      <div
                        className="mono-h3"
                        style={
                          checked
                            ? { textDecoration: 'line-through', color: 'var(--mono-muted)' }
                            : undefined
                        }
                      >
                        {h.name}
                      </div>
                      <div className="mono-meta">{metaParts.join(' · ')}</div>
                    </div>
                  </div>
                );
              })}
            </MonoCard>
          )}
          {onManage ? (
            <div style={{ marginTop: 10 }}>
              <MonoBtn variant="ghost" onClick={onManage}>
                {t('mono.azi.habitsManage')}
              </MonoBtn>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
