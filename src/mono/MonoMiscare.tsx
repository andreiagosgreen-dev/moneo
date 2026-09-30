import { useState } from 'react';
import MonoBtn from './MonoBtn';
import MonoHead from './MonoHead';
import MonoExerciseIcon from './MonoExerciseIcon';
import MonoWorkoutPlayer, { fitDose, type HabitLink } from './MonoWorkoutPlayer';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { Habit } from '../lib/habits';
import {
  EXERCISES,
  FIT_CATEGORIES,
  fitKey,
  getRoutine,
  ROUTINES,
  routineMinutes,
  type FitCategory,
} from '../lib/fitness/library';
import {
  recentWorkouts,
  weekSummary,
  workoutVolume,
  type WorkoutEntry,
  type WorkoutStore,
} from '../lib/fitness/workouts';
import { getActiveRun } from '../lib/fitness/player';

interface Props {
  store: WorkoutStore;
  habits: Habit[];
  isPro: boolean;
  onSave: (entry: WorkoutEntry, link: HabitLink) => void;
  onDelete: (id: string) => void;
}

type Filter = FitCategory | 'all';

/** Move tab: week summary, ready-made routines, exercise library, history. */
export default function MonoMiscare({ store, habits, isPro, onSave, onDelete }: Props) {
  const { t, tp, fmtDur, fmtDayKey, fmtNum } = useI18n();
  const [playing, setPlaying] = useState<string | null>(() => getActiveRun()?.routineId ?? null);
  const [filter, setFilter] = useState<Filter>('home');
  const [saved, setSaved] = useState(false);

  const week = weekSummary(store.log);
  const recent = recentWorkouts(store.log, 5);
  const exercises = filter === 'all' ? EXERCISES : EXERCISES.filter((e) => e.category === filter);
  const routineName = (id: string) => (getRoutine(id) ? t(fitKey.rtName(id)) : id);

  const start = (id: string) => {
    setSaved(false);
    setPlaying(id);
    document.getElementById('fit-top')?.scrollIntoView?.({ block: 'start' });
  };

  return (
    <div id="fit-top">
      <MonoHead title={t('nav.move')} sub={t('fit.sub')} />
      <div className="mono-pad">
        {playing ? (
          <MonoWorkoutPlayer
            routineId={playing}
            log={store.log}
            habits={habits}
            preferredHabitId={store.habitId}
            isPro={isPro}
            onSave={(entry, link) => {
              onSave(entry, link);
              setSaved(true);
            }}
            onClose={() => setPlaying(null)}
          />
        ) : (
          <>
            {saved ? (
              <p className="mono-fit-flash" role="status">
                {t('fit.d.saved')}
              </p>
            ) : null}

            <section className="mono-card mono-fit-week" aria-labelledby="fit-week-title">
              <h2 className="mono-eyebrow" id="fit-week-title">
                {t('fit.weekTitle')}
              </h2>
              {week.count > 0 ? (
                <>
                  <p className="mono-h2">{tp('fit.weekCount', week.count)}</p>
                  <p className="mono-meta">
                    {t('fit.weekMeta', { dur: fmtDur(week.minutes), days: week.days })}
                  </p>
                </>
              ) : (
                <p className="mono-meta">{t('fit.weekEmpty')}</p>
              )}
            </section>

            <section className="mono-sec" aria-labelledby="fit-routines-title">
              <h2 className="mono-h3" id="fit-routines-title">
                {t('fit.routines')}
              </h2>
              <p className="mono-meta">{t('fit.routinesSub')}</p>
              <ul className="mono-fit-grid">
                {ROUTINES.map((r) => {
                  const name = t(fitKey.rtName(r.id));
                  return (
                    <li key={r.id} className="mono-fit-card" data-testid={`fit-rt-${r.id}`}>
                      <MonoExerciseIcon pose={r.icon} size={44} />
                      <div className="mono-fit-card-copy">
                        <p className="mono-fit-name">{name}</p>
                        <p className="mono-meta mono-fit-small">{t(fitKey.rtDesc(r.id))}</p>
                        <div className="mono-fit-card-foot">
                          <p className="mono-meta mono-fit-small mono-fit-num">
                            {t(fitKey.cat(r.category))} ·{' '}
                            {t('fit.routineMeta', { min: routineMinutes(r), n: r.steps.length })}
                          </p>
                          <MonoBtn
                            type="button"
                            aria-label={t('fit.startAria', { name })}
                            onClick={() => start(r.id)}
                          >
                            {t('fit.start')}
                          </MonoBtn>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="mono-sec" aria-labelledby="fit-library-title">
              <h2 className="mono-h3" id="fit-library-title">
                {t('fit.library')}
              </h2>
              <p className="mono-meta">{t('fit.librarySub')}</p>
              <div className="mono-fit-filters" role="group" aria-label={t('fit.filterAria')}>
                {(['all', ...FIT_CATEGORIES] as Filter[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="mono-chip"
                    aria-pressed={filter === c}
                    onClick={() => setFilter(c)}
                  >
                    {c === 'all' ? t('fit.cat.all') : t(fitKey.cat(c))}
                  </button>
                ))}
              </div>
              <ul className="mono-fit-list" data-testid="fit-library">
                {exercises.map((e) => (
                  <li key={e.id}>
                    <details className="mono-fit-ex">
                      <summary className="mono-fit-row">
                        <MonoExerciseIcon pose={e.pose} size={44} />
                        <span className="mono-fit-row-copy">
                          <span className="mono-fit-name">{t(fitKey.exName(e.id))}</span>
                          <span className="mono-meta mono-fit-small">
                            {t(fitKey.muscle(e.muscle))} · {t(fitKey.eq(e.equipment))} ·{' '}
                            {fitDose(t, e)}
                          </span>
                        </span>
                        <span className="mono-tpl-chev" aria-hidden>
                          ›
                        </span>
                      </summary>
                      <p className="mono-meta mono-fit-small mono-fit-howto">
                        {t(fitKey.exCue(e.id))}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mono-sec" aria-labelledby="fit-history-title">
              <h2 className="mono-h3" id="fit-history-title">
                {t('fit.history')}
              </h2>
              {recent.length > 0 ? (
                <ul className="mono-fit-list" data-testid="fit-history">
                  {recent.map((w) => {
                    const name = routineName(w.routineId);
                    const volume = workoutVolume(w.sets);
                    const date = fmtDayKey(w.day);
                    return (
                      <li key={w.id} className="mono-fit-row">
                        <div className="mono-fit-row-copy">
                          <p className="mono-fit-name">{name}</p>
                          <p className="mono-meta mono-fit-small">
                            {date} ·{' '}
                            {t('fit.historyMeta', {
                              dur: fmtDur(Math.max(1, Math.round(w.durationSec / 60))),
                              sets: w.sets.length,
                            })}
                            {volume > 0
                              ? ` · ${t('fit.historyVolume', { kg: fmtNum(volume) })}`
                              : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="mono-fit-del"
                          aria-label={t('fit.deleteAria', { name, date })}
                          onClick={() => onDelete(w.id)}
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mono-meta">{t('fit.historyEmpty')}</p>
              )}
              <p className="mono-meta mono-fit-small mono-fit-note">{t('fit.localNote')}</p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
