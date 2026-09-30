import { useMemo, useState } from 'react';
import MonoBtn from './MonoBtn';
import MonoHead from './MonoHead';
import MonoRing from './MonoRing';
import MonoExerciseIcon from './MonoExerciseIcon';
import MonoBodyMap from './MonoBodyMap';
import MonoExerciseDetail from './MonoExerciseDetail';
import MonoWorkoutPlayer, { fitDose, type HabitLink } from './MonoWorkoutPlayer';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { Habit } from '../lib/habits';
import {
  EQUIPMENT,
  FIT_PLACES,
  FIT_TYPES,
  MUSCLES,
  filterExercises,
  fitKey,
  getExercise,
  getRoutine,
  ROUTINES,
  routineMinutes,
  type Equipment,
  type FitPlace,
  type FitType,
  type Muscle,
} from '../lib/fitness/library';
import {
  heatLevels,
  muscleLoad,
  recentWorkouts,
  routineDays,
  setRoutineDays,
  weekGoal,
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
  /** Place and schedule changes. */
  onChange: (next: WorkoutStore) => void;
}

type Any<T> = T | 'all';

const PAGE = 20;
/** Monday-first weekday order (0 = Sunday). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

const scrollTo = (id: string, block: ScrollLogicalPosition = 'start') =>
  document.getElementById(id)?.scrollIntoView?.({ block });

/** Move tab: week ring, place, routines + schedule, body map, library, history. */
export default function MonoMiscare({ store, habits, isPro, onSave, onDelete, onChange }: Props) {
  const { t, tp, tag, fmtDur, fmtDayKey, fmtNum } = useI18n();
  const [playing, setPlaying] = useState<string | null>(() => getActiveRun()?.routineId ?? null);
  const [saved, setSaved] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [type, setType] = useState<Any<FitType>>('all');
  const [muscle, setMuscle] = useState<Any<Muscle>>('all');
  const [equipment, setEquipment] = useState<Any<Equipment>>('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [planOpen, setPlanOpen] = useState<string | null>(null);
  const [mapDays, setMapDays] = useState<7 | 30>(7);
  const place: Any<FitPlace> = store.place ?? 'all';

  const week = weekSummary(store.log);
  const goal = weekGoal(store);
  const recent = recentWorkouts(store.log, 5);
  const routines = place === 'all' ? ROUTINES : ROUTINES.filter((r) => r.places.includes(place));
  const exercises = filterExercises(
    {
      place: place === 'all' ? undefined : place,
      type: type === 'all' ? undefined : type,
      muscle: muscle === 'all' ? undefined : muscle,
      equipment: equipment === 'all' ? undefined : equipment,
      query,
    },
    (id) => t(fitKey.exName(id)),
  );
  const filtered = type !== 'all' || muscle !== 'all' || equipment !== 'all' || query !== '';
  const levels = useMemo(() => heatLevels(muscleLoad(store.log, mapDays)), [store.log, mapDays]);
  const trained = MUSCLES.some((m) => (levels[m] ?? 0) > 0);
  const resting = trained ? MUSCLES.filter((m) => (levels[m] ?? 0) === 0) : [];
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' }),
    [tag],
  );
  const dayName = (d: number) => dayFmt.format(Date.UTC(2024, 0, d === 0 ? 7 : d));
  const routineName = (id: string) => (getRoutine(id) ? t(fitKey.rtName(id)) : id);

  const start = (id: string) => {
    setSaved(false);
    setPlaying(id);
    scrollTo('fit-top');
  };
  const pickPlace = (p: Any<FitPlace>) => {
    const next = { ...store };
    if (p === 'all') delete next.place;
    else next.place = p;
    onChange(next);
    setShown(PAGE);
  };
  const toggleDay = (routineId: string, day: number) => {
    const days = routineDays(store, routineId);
    onChange(
      setRoutineDays(
        store,
        routineId,
        days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
      ),
    );
  };
  const pickMuscle = (m: Muscle) => {
    setMuscle((cur) => (cur === m ? 'all' : m));
    setShown(PAGE);
    scrollTo('fit-library-title');
  };
  const resetFilters = () => {
    setType('all');
    setMuscle('all');
    setEquipment('all');
    setQuery('');
    setShown(PAGE);
  };
  const openDetail = (id: string) => {
    setDetail(id);
    scrollTo('fit-top');
  };
  const closeDetail = () => {
    const id = detail;
    setDetail(null);
    if (id) requestAnimationFrame(() => scrollTo(`fit-ex-${id}`, 'center'));
  };

  const detailEx = detail ? getExercise(detail) : undefined;

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
        ) : detailEx ? (
          <MonoExerciseDetail ex={detailEx} onBack={closeDetail} onOpen={openDetail} />
        ) : (
          <>
            {saved ? (
              <p className="mono-fit-flash" role="status">
                {t('fit.d.saved')}
              </p>
            ) : null}

            <section className="mono-card mono-fit-week" aria-labelledby="fit-week-title">
              <MonoRing
                value={goal.pct}
                size={64}
                label={t('fit.week.ringAria', { done: goal.done, goal: goal.goal })}
              >
                <span className="mono-fit-num">
                  {fmtNum(goal.done)}/{fmtNum(goal.goal)}
                </span>
              </MonoRing>
              <div className="mono-fit-week-copy">
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
                <p className="mono-meta mono-fit-small">
                  {goal.planned
                    ? t('fit.week.goalPlan', { done: goal.done, goal: goal.goal })
                    : t('fit.week.goal', { goal: goal.goal })}
                </p>
              </div>
            </section>

            <section className="mono-sec" aria-labelledby="fit-place-title">
              <h2 className="mono-h3" id="fit-place-title">
                {t('fit.place.title')}
              </h2>
              <div className="mono-fit-filters" role="group" aria-label={t('fit.filterAria')}>
                {(['all', ...FIT_PLACES] as Any<FitPlace>[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="mono-chip"
                    aria-pressed={place === p}
                    onClick={() => pickPlace(p)}
                  >
                    {p === 'all' ? t('fit.place.all') : t(fitKey.place(p))}
                  </button>
                ))}
              </div>
            </section>

            <section className="mono-sec" aria-labelledby="fit-routines-title">
              <h2 className="mono-h3" id="fit-routines-title">
                {t('fit.routines')}
              </h2>
              <p className="mono-meta">{t('fit.routinesSub')}</p>
              <ul className="mono-fit-grid">
                {routines.map((r) => {
                  const name = t(fitKey.rtName(r.id));
                  const days = routineDays(store, r.id);
                  const open = planOpen === r.id;
                  return (
                    <li key={r.id} className="mono-fit-card" data-testid={`fit-rt-${r.id}`}>
                      <MonoExerciseIcon pose={r.icon} size={44} />
                      <div className="mono-fit-card-copy">
                        <p className="mono-fit-name">{name}</p>
                        <p className="mono-meta mono-fit-small">{t(fitKey.rtDesc(r.id))}</p>
                        <p className="mono-meta mono-fit-small mono-fit-num">
                          {t(fitKey.type(r.type))} ·{' '}
                          {t('fit.routineMeta', { min: routineMinutes(r), n: r.steps.length })}
                        </p>
                        {days.length > 0 ? (
                          <p className="mono-fit-small mono-fit-planned">
                            {t('fit.plan.on', { days: days.map(dayName).join(', ') })}
                          </p>
                        ) : null}
                        {open ? (
                          <div
                            className="mono-fit-days"
                            role="group"
                            aria-label={t('fit.plan.days', { name })}
                          >
                            {WEEK.map((d) => (
                              <button
                                key={d}
                                type="button"
                                className="mono-chip mono-chip-sm"
                                aria-pressed={days.includes(d)}
                                onClick={() => toggleDay(r.id, d)}
                              >
                                {dayName(d)}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <div className="mono-fit-card-foot">
                          <button
                            type="button"
                            className="mono-link-btn"
                            aria-expanded={open}
                            aria-label={t('fit.plan.aria', { name })}
                            onClick={() => setPlanOpen(open ? null : r.id)}
                          >
                            {open ? t('fit.plan.close') : t('fit.plan.btn')}
                          </button>
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

            <section className="mono-sec" aria-labelledby="fit-map-title">
              <div className="mono-fit-sechead">
                <h2 className="mono-h3" id="fit-map-title">
                  {t('fit.map.title')}
                </h2>
                <div className="mono-fit-filters" role="group" aria-label={t('fit.map.range')}>
                  <button
                    type="button"
                    className="mono-chip mono-chip-sm"
                    aria-pressed={mapDays === 7}
                    onClick={() => setMapDays(7)}
                  >
                    {t('fit.map.days7')}
                  </button>
                  <button
                    type="button"
                    className="mono-chip mono-chip-sm"
                    aria-pressed={mapDays === 30}
                    disabled={!isPro}
                    title={isPro ? undefined : t('fit.map.pro')}
                    onClick={() => setMapDays(30)}
                  >
                    {t('fit.map.days30')}
                    {isPro ? '' : ' · Pro'}
                  </button>
                </div>
              </div>
              <p className="mono-meta">{t('fit.map.sub')}</p>
              <div className="mono-fit-map">
                <MonoBodyMap
                  levels={levels}
                  selected={muscle === 'all' ? null : muscle}
                  onPick={pickMuscle}
                  label={t('fit.map.title')}
                />
                <div className="mono-fit-map-legend" aria-hidden="true">
                  <span>{t('fit.map.less')}</span>
                  {[0, 1, 2, 3].map((lv) => (
                    <i key={lv} className="mono-fit-swatch" data-lv={lv} />
                  ))}
                  <span>{t('fit.map.more')}</span>
                </div>
              </div>
              <p className="mono-meta mono-fit-small">
                {trained
                  ? resting.length > 0
                    ? t('fit.map.resting', {
                        list: resting
                          .slice(0, 5)
                          .map((m) => t(fitKey.muscle(m)))
                          .join(', '),
                      })
                    : t('fit.map.all')
                  : t('fit.map.empty')}
              </p>
            </section>

            <section className="mono-sec" aria-labelledby="fit-library-title">
              <h2 className="mono-h3" id="fit-library-title">
                {t('fit.library')}
              </h2>
              <p className="mono-meta">{t('fit.lib.sub')}</p>
              <input
                type="search"
                className="mono-field mono-fit-search"
                value={query}
                placeholder={t('fit.lib.search')}
                aria-label={t('fit.lib.search')}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(PAGE);
                }}
              />
              <div className="mono-fit-filters" role="group" aria-label={t('fit.lib.typeAria')}>
                {(['all', ...FIT_TYPES] as Any<FitType>[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="mono-chip"
                    aria-pressed={type === c}
                    onClick={() => {
                      setType(c);
                      setShown(PAGE);
                    }}
                  >
                    {c === 'all' ? t('fit.type.all') : t(fitKey.type(c))}
                  </button>
                ))}
              </div>
              <div className="mono-fit-selects">
                <label className="mono-fit-select">
                  <span className="mono-eyebrow">{t('fit.lib.muscle')}</span>
                  <select
                    className="mono-field mono-field-sm"
                    value={muscle}
                    onChange={(e) => {
                      setMuscle(e.target.value as Any<Muscle>);
                      setShown(PAGE);
                    }}
                  >
                    <option value="all">{t('fit.muscle.all')}</option>
                    {MUSCLES.map((m) => (
                      <option key={m} value={m}>
                        {t(fitKey.muscle(m))}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mono-fit-select">
                  <span className="mono-eyebrow">{t('fit.lib.equipment')}</span>
                  <select
                    className="mono-field mono-field-sm"
                    value={equipment}
                    onChange={(e) => {
                      setEquipment(e.target.value as Any<Equipment>);
                      setShown(PAGE);
                    }}
                  >
                    <option value="all">{t('fit.eq.all')}</option>
                    {EQUIPMENT.map((q) => (
                      <option key={q} value={q}>
                        {t(fitKey.eq(q))}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mono-fit-count">
                <p className="mono-meta" aria-live="polite" data-testid="fit-count">
                  {tp('fit.lib.count', exercises.length)}
                </p>
                {filtered ? (
                  <button type="button" className="mono-link-btn" onClick={resetFilters}>
                    {t('fit.lib.reset')}
                  </button>
                ) : null}
              </div>
              {exercises.length > 0 ? (
                <ul className="mono-fit-list" data-testid="fit-library">
                  {exercises.slice(0, shown).map((e) => {
                    const name = t(fitKey.exName(e.id));
                    return (
                      <li key={e.id} id={`fit-ex-${e.id}`}>
                        <button
                          type="button"
                          className="mono-fit-row mono-fit-rowbtn"
                          aria-label={t('fit.lib.openAria', { name })}
                          onClick={() => openDetail(e.id)}
                        >
                          <MonoExerciseIcon pose={e.pose} size={44} />
                          <span className="mono-fit-row-copy">
                            <span className="mono-fit-name">{name}</span>
                            <span className="mono-meta mono-fit-small">
                              {t(fitKey.muscle(e.muscles[0]))} · {t(fitKey.eq(e.equipment))} ·{' '}
                              {fitDose(t, e)}
                            </span>
                          </span>
                          <span className="mono-tpl-chev" aria-hidden>
                            ›
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mono-empty">{t('fit.lib.empty')}</p>
              )}
              {exercises.length > shown ? (
                <MonoBtn
                  type="button"
                  variant="ghost"
                  block
                  onClick={() => setShown((n) => n + PAGE)}
                >
                  {t('fit.lib.more', { n: exercises.length - shown })}
                </MonoBtn>
              ) : null}
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
