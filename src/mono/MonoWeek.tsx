import { useMemo, useState } from 'react';
import MonoChip from './MonoChip';
import MonoRing from './MonoRing';
import { buildWeek, type WeekDay } from '../lib/weekView';
import { addDays, dayKeyDiff, mondayOf, parseDayKey } from '../lib/dayKeys';
import { dayKeyInTz } from '../lib/timezone';
import type { IvyPlan } from '../lib/ivyLee';
import type { Task } from '../lib/tasks';
import type { Session } from '../lib/store';
import type { Habit, HabitLog } from '../lib/habits';
import type { EnergyEntry } from '../lib/energy';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  plans: IvyPlan[];
  tasks: Task[];
  history: Session[];
  habits: Habit[];
  habitLog: HabitLog;
  energyLog?: EnergyEntry[];
  timezone: string;
  onOpenToday: () => void;
  now?: number;
}

const WEEKS_BACK = 12;
const WEEKS_AHEAD = 4;
const DUE_SHOWN = 3;

/** Seven-day planner for Orar: plan ring, focus, habits and deadlines per day. */
export default function MonoWeek({
  plans,
  tasks,
  history,
  habits,
  habitLog,
  energyLog,
  timezone,
  onOpenToday,
  now = Date.now(),
}: Props) {
  const { t, tag, fmtNum, fmtDur, fmtDayKey } = useI18n();
  const todayKey = dayKeyInTz(now, timezone);
  const currentMonday = mondayOf(todayKey);
  const [mondayKey, setMondayKey] = useState(currentMonday);
  const [selected, setSelected] = useState<string | null>(null);
  const offset = Math.round(dayKeyDiff(currentMonday, mondayKey) / 7);

  const days = useMemo(
    () =>
      buildWeek({
        mondayKey,
        todayKey,
        timezone,
        plans,
        tasks,
        history,
        habits,
        habitLog,
        energyLog,
      }),
    [mondayKey, todayKey, timezone, plans, tasks, history, habits, habitLog, energyLog],
  );
  const fmt = useMemo(
    () => ({
      short: new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' }),
      long: new Intl.DateTimeFormat(tag, { weekday: 'long', timeZone: 'UTC' }),
    }),
    [tag],
  );
  const weekday = (key: string, style: 'short' | 'long') => {
    const p = parseDayKey(key);
    return p ? fmt[style].format(Date.UTC(p.y, p.m - 1, p.d)) : key;
  };
  const range = `${fmtDayKey(days[0].key)} – ${fmtDayKey(days[6].key)}`;
  const empty = days.every(
    (d) => d.planTotal === 0 && d.focusMin === 0 && d.habitsDone === 0 && d.due.length === 0,
  );
  const selectedDay = days.find((d) => d.key === selected) ?? null;

  const move = (weeks: number) => {
    setMondayKey(addDays(mondayKey, weeks * 7));
    setSelected(null);
  };

  const onDay = (d: WeekDay) => {
    if (d.isToday) {
      onOpenToday();
      return;
    }
    setSelected((cur) => (cur === d.key ? null : d.key));
  };

  const dayName = (key: string) => `${weekday(key, 'long')} ${fmtDayKey(key)}`;

  return (
    <section className="mono-week-wrap" aria-label={t('mono.week.title')}>
      <div className="mono-week-head">
        <button
          type="button"
          className="mono-week-nav"
          aria-label={t('mono.week.prev')}
          disabled={offset <= -WEEKS_BACK}
          onClick={() => move(-1)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
        </button>
        <div className="mono-week-title">
          <p className="mono-eyebrow" style={{ marginBottom: 2 }}>
            {t('mono.week.title')}
          </p>
          <p className="mono-h3 mono-week-range" aria-live="polite">
            {range}
          </p>
        </div>
        <button
          type="button"
          className="mono-week-nav"
          aria-label={t('mono.week.next')}
          disabled={offset >= WEEKS_AHEAD}
          onClick={() => move(1)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7.5 4.5 13 10l-5.5 5.5" />
          </svg>
        </button>
      </div>
      {offset !== 0 ? (
        <div className="mono-week-back">
          <MonoChip type="button" onClick={() => move(-offset)}>
            {t('mono.week.current')}
          </MonoChip>
        </div>
      ) : null}

      <ul className="mono-week" role="list">
        {days.map((d) => {
          const showRing = d.planTotal > 0 && !d.isFuture;
          const habitsText = `${fmtNum(d.habitsDone)}/${fmtNum(d.habitsTotal)}`;
          const aria = t('mono.week.dayAria', {
            day: dayName(d.key),
            done: fmtNum(d.planDone),
            total: fmtNum(d.planTotal),
            dur: fmtDur(d.focusMin),
            habits: habitsText,
          });
          const cls = [
            'mono-week-day',
            d.isToday ? 'is-today' : '',
            d.isFuture ? 'is-future' : '',
            selected === d.key ? 'is-open' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li key={d.key} role="listitem" className={cls}>
              <button
                type="button"
                className="mono-week-btn"
                aria-label={aria}
                aria-expanded={d.isToday ? undefined : selected === d.key}
                onClick={() => onDay(d)}
              >
                <span className="mono-week-when">
                  <span className="mono-week-name">{weekday(d.key, 'short')}</span>
                  <span className="mono-week-date">{fmtDayKey(d.key)}</span>
                </span>
                <span className="mono-week-ring">
                  {showRing ? (
                    <MonoRing value={d.pct} size={44} stroke={5} label={aria}>
                      <span className="mono-week-pct">{fmtNum(d.pct)}</span>
                    </MonoRing>
                  ) : (
                    <span className="mono-week-dash" aria-hidden="true">
                      –
                    </span>
                  )}
                </span>
                <span className="mono-week-metrics">
                  {d.planTotal > 0 ? (
                    <span>
                      {t('mono.week.plan', {
                        done: fmtNum(d.planDone),
                        total: fmtNum(d.planTotal),
                      })}
                    </span>
                  ) : null}
                  {d.focusMin > 0 ? (
                    <span>{t('mono.week.focus', { dur: fmtDur(d.focusMin) })}</span>
                  ) : null}
                  {d.habitsTotal > 0 ? (
                    <span>
                      {t('mono.week.habits', {
                        done: fmtNum(d.habitsDone),
                        total: fmtNum(d.habitsTotal),
                      })}
                    </span>
                  ) : null}
                  {d.energy !== null ? (
                    <span className="mono-week-checkin">
                      {d.mood !== null
                        ? t('mono.checkin.summary', { e: fmtNum(d.energy), m: fmtNum(d.mood) })
                        : t('mono.checkin.summaryEnergy', { e: fmtNum(d.energy) })}
                    </span>
                  ) : null}
                </span>
                {d.due.length > 0 ? (
                  <span className="mono-week-due">
                    {d.due.slice(0, DUE_SHOWN).map((task) => (
                      <span
                        key={task.id}
                        className={`mono-week-task${task.done ? ' is-done' : ''}`}
                        data-prio={task.priority}
                      >
                        {task.title}
                      </span>
                    ))}
                    {d.due.length > DUE_SHOWN ? (
                      <span className="mono-week-more">
                        {t('mono.week.more', { n: fmtNum(d.due.length - DUE_SHOWN) })}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {empty ? <p className="mono-meta mono-week-empty">{t('mono.week.empty')}</p> : null}

      {selectedDay ? (
        <div
          className="mono-week-details"
          role="region"
          aria-label={t('mono.week.details', { day: dayName(selectedDay.key) })}
        >
          <p className="mono-eyebrow">
            {t('mono.week.details', { day: dayName(selectedDay.key) })}
          </p>
          {selectedDay.plan.length === 0 && selectedDay.due.length === 0 ? (
            <p className="mono-meta">{t('mono.week.dayEmpty')}</p>
          ) : (
            <ul className="mono-week-list">
              {selectedDay.plan.map((x) => (
                <li key={`p-${x.id}`} className={x.done ? 'is-done' : undefined}>
                  {x.text}
                </li>
              ))}
              {selectedDay.due.map((x) => (
                <li
                  key={`d-${x.id}`}
                  className={x.done ? 'is-done' : undefined}
                  data-prio={x.priority}
                >
                  {x.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
