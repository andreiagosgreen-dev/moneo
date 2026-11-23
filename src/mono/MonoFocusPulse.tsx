import { useMemo } from 'react';
import { addDays } from '../lib/dayKeys';
import { heatLevels, muscleLoad, type WorkoutStore } from '../lib/fitness/workouts';
import type { Habit, HabitLog } from '../lib/habits';
import { useI18n } from '../lib/i18n/LocaleContext';
import MonoBodyMap from './MonoBodyMap';

const DAYS = 28;

interface Props {
  day: string;
  habits: Habit[];
  habitLog: HabitLog;
  workouts: WorkoutStore['log'];
  onOpenBody: () => void;
  onOpenHabits: () => void;
}

export default function MonoFocusPulse({
  day,
  habits,
  habitLog,
  workouts,
  onOpenBody,
  onOpenHabits,
}: Props) {
  const { t, fmtNum } = useI18n();
  const levels = useMemo(() => heatLevels(muscleLoad(workouts, 7)), [workouts]);
  const activity = useMemo(() => {
    const checkIns = new Map<string, number>();
    for (const habit of habits) {
      if (habit.archived) continue;
      for (const date of habitLog[habit.id] ?? []) {
        checkIns.set(date, (checkIns.get(date) ?? 0) + 1);
      }
    }
    return Array.from(
      { length: DAYS },
      (_, index) => checkIns.get(addDays(day, index + 1 - DAYS)) ?? 0,
    );
  }, [day, habits, habitLog]);
  const activeDays = activity.filter((count) => count > 0).length;
  const summary = t('rep.ins.habitDays', { hits: fmtNum(activeDays), days: fmtNum(DAYS) });

  return (
    <div className="atm-pulse">
      <section className="atm-pulse-block" aria-label={t('fit.map.title')}>
        <button type="button" className="atm-pulse-heading" onClick={onOpenBody}>
          {t('fit.map.title')}
        </button>
        <div className="atm-pulse-map">
          <MonoBodyMap levels={levels} label={t('fit.map.title')} />
        </div>
      </section>
      <section className="atm-pulse-block" aria-label={t('mono.azi.habits')}>
        <button type="button" className="atm-pulse-heading" onClick={onOpenHabits}>
          {t('mono.azi.habits')}
          <span>{summary}</span>
        </button>
        <div className="atm-pulse-habits" role="img" aria-label={summary}>
          {activity.map((count, index) => (
            <span
              key={index}
              aria-hidden="true"
              data-level={Math.min(3, count)}
              data-today={index === DAYS - 1 || undefined}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
