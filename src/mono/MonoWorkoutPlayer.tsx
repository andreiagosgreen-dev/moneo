import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MonoBtn from './MonoBtn';
import MonoChip from './MonoChip';
import MonoExerciseIcon from './MonoExerciseIcon';
import MonoExercisePicker from './MonoExercisePicker';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { I18n } from '../lib/i18n';
import { activeHabits, FREE_HABITS_LIMIT, type Habit } from '../lib/habits';
import {
  fitKey,
  getExercise,
  setWorkSec,
  type FitPlace,
  type PoseId,
  type RoutineStep,
} from '../lib/fitness/library';
import { FREE_RUN_ID, MAX_ROUTINE_NAME, stepsFromSets } from '../lib/fitness/custom';
import { findFitnessHabit, newWorkoutEntry, type WorkoutEntry } from '../lib/fitness/workouts';
import {
  LEAD_IN_MS,
  countdownCue,
  loadSoundPrefs,
  saveSoundPrefs,
  type WorkoutSoundPrefs,
} from '../lib/fitness/cues';
import {
  beep,
  canSpeak,
  onVoicesReady,
  speak,
  stopSpeaking,
  type BeepKind,
} from '../lib/fitness/workoutAudio';
import { WEIGHTED_GEAR } from '../lib/fitness/packs';
import {
  addFreeStep,
  currentStep,
  endRest,
  finishRun,
  getActiveRun,
  isPicking,
  logSet,
  nextStep,
  pauseTimer,
  repsSet,
  restLeftMs,
  runProgress,
  runSteps,
  setActiveRun,
  shouldSwitchSides,
  skipExercise,
  startFreeRun,
  startRun,
  startTimer,
  timedSet,
  timerLeftMs,
  type RunState,
} from '../lib/fitness/player';

export type HabitLink =
  { kind: 'none' } | { kind: 'habit'; id: string } | { kind: 'create'; name: string };

interface Props {
  routineId: string;
  /** Display name of the routine (built-in, custom or free). */
  title: string;
  /** Steps of a custom routine; built-ins resolve by id. */
  steps?: RoutineStep[];
  icon?: PoseId;
  place?: FitPlace;
  log: WorkoutEntry[];
  habits: Habit[];
  preferredHabitId?: string;
  isPro: boolean;
  /** `routine`: a free workout the user also wants as their own routine. */
  onSave: (entry: WorkoutEntry, link: HabitLink, routine?: RoutineDraft) => void;
  /** Offer "save as my routine" after a free workout. */
  canSaveRoutine?: boolean;
  /** The user's own weights (kg), offered as one-tap picks on weighted gear. */
  weights?: number[];
  onClose: () => void;
}

export interface RoutineDraft {
  name: string;
  steps: RoutineStep[];
}

export function fitDose(
  t: I18n['t'],
  d: { sets: number; reps?: number; sec?: number; sides?: boolean },
): string {
  const base =
    typeof d.sec === 'number'
      ? d.sec >= 120 && d.sec % 60 === 0
        ? t('fit.dose.min', { sets: d.sets, min: d.sec / 60 })
        : t('fit.dose.time', { sets: d.sets, sec: d.sec })
      : t('fit.dose.reps', { sets: d.sets, reps: d.reps ?? 0 });
  return d.sides ? `${base} · ${t('fit.dose.perSide')}` : base;
}

function clock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function buzz() {
  try {
    navigator.vibrate?.(180);
  } catch {
    /* not supported */
  }
}

/** Guided workout: one exercise at a time, sets, rest countdown, then save. */
export default function MonoWorkoutPlayer({
  routineId,
  title,
  steps,
  icon,
  place,
  log,
  habits,
  preferredHabitId,
  isPro,
  onSave,
  canSaveRoutine = false,
  weights = [],
  onClose,
}: Props) {
  const { t, tag, fmtNum } = useI18n();
  const [run, setRun] = useState<RunState | null>(() => {
    const parked = getActiveRun();
    if (parked && parked.routineId === routineId) return parked;
    if (routineId === FREE_RUN_ID) return startFreeRun(Date.now());
    return startRun(routineId, Date.now(), log, steps);
  });
  const [now, setNow] = useState(() => Date.now());
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [prefs, setPrefs] = useState<WorkoutSoundPrefs>(loadSoundPrefs);
  const [voiceOk, setVoiceOk] = useState(() => canSpeak(tag));
  /** 3-2-1 before a timed hold started by hand. */
  const [leadUntil, setLeadUntil] = useState<number | null>(null);
  const prevLeft = useRef<{ key: string; ms: number } | null>(null);
  const spoken = useRef('');

  useEffect(() => onVoicesReady(() => setVoiceOk(canSpeak(tag))), [tag]);
  useEffect(() => stopSpeaking, []);

  const cue = useCallback((kind: BeepKind) => prefs.beeps && beep(kind), [prefs.beeps]);
  const say = useCallback(
    (text: string) => prefs.voice && voiceOk && speak(text, tag),
    [prefs.voice, voiceOk, tag],
  );
  const setPref = (key: keyof WorkoutSoundPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    saveSoundPrefs(next);
    if (key === 'voice' && !value) stopSpeaking();
  };

  useEffect(() => {
    setActiveRun(run);
  }, [run]);

  const ticking = run?.phase === 'rest' || run?.timer?.endsAt !== undefined || leadUntil !== null;
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [ticking]);

  useEffect(() => {
    if (!run) return;
    // Countdown beeps: the last three seconds of the lead-in, a rest or a timed hold.
    let key: string | null = null;
    let ms = 0;
    if (leadUntil !== null) {
      key = 'lead';
      ms = Math.max(0, leadUntil - now);
    } else if (run.phase === 'rest') {
      key = `rest:${run.stepIdx}:${run.setIdx}`;
      ms = restLeftMs(run, now);
    } else if (run.timer?.endsAt !== undefined) {
      key = `hold:${run.stepIdx}:${run.setIdx}`;
      ms = timerLeftMs(run, now);
    }
    const prev = prevLeft.current;
    if (key && prev?.key === key) {
      const c = countdownCue(prev.ms, ms);
      if (c) cue(c);
    }
    prevLeft.current = key ? { key, ms } : null;

    if (leadUntil !== null) {
      if (now >= leadUntil) {
        setLeadUntil(null);
        if (run.phase === 'work') setRun(startTimer(run, Date.now()));
      }
      return;
    }
    if (run.phase === 'rest' && restLeftMs(run, now) === 0) {
      const next = endRest(run);
      // The rest's own 3-2-1 already counted in: a timed hold can start right away.
      setRun(prefs.autoStart && next.timer ? startTimer(next, Date.now()) : next);
      buzz();
    } else if (
      run.phase === 'work' &&
      run.timer?.endsAt !== undefined &&
      timerLeftMs(run, now) === 0
    ) {
      const set = timedSet(run, now);
      if (set) setRun(logSet(run, set, now, log));
      buzz();
    }
  }, [now, run, log, leadUntil, prefs.autoStart, cue]);

  // Spoken cues: what comes next during a rest, the exercise name when it starts, the end.
  useEffect(() => {
    if (!run) return;
    const step = currentStep(run);
    let key = '';
    let text = '';
    if (run.phase === 'done') {
      key = 'done';
      text = t('fit.voice.done');
    } else if (run.phase === 'rest' && step) {
      key = `rest:${run.stepIdx}:${run.setIdx}`;
      text = t('fit.voice.rest', { name: t(fitKey.exName(step.ex)) });
    } else if (run.phase === 'work' && step && run.setIdx === 0) {
      key = `work:${run.stepIdx}`;
      text = t(fitKey.exName(step.ex));
    }
    if (!key || key === spoken.current) return;
    spoken.current = key;
    if (key === 'done') cue('done');
    say(text);
  }, [run, t, say, cue]);

  const switchNow = run ? shouldSwitchSides(run, now) : false;
  const sideKey = run ? `${run.stepIdx}:${run.setIdx}` : '';
  useEffect(() => {
    if (!switchNow) return;
    cue('tick');
    say(t('fit.p.switchSides'));
  }, [switchNow, sideKey, cue, say, t]);

  if (!run) {
    return (
      <section className="mono-fit-player">
        <MonoBtn type="button" variant="ghost" onClick={onClose}>
          {t('fit.p.quit')}
        </MonoBtn>
      </section>
    );
  }

  const quit = () => {
    setActiveRun(null);
    onClose();
  };

  if (run.phase === 'done') {
    return (
      <DoneView
        run={run}
        title={title}
        icon={icon}
        habits={habits}
        preferredHabitId={preferredHabitId}
        isPro={isPro}
        canSaveRoutine={run.free === true && canSaveRoutine}
        onSave={(link, routineName) => {
          const entry = newWorkoutEntry(
            run.routineId,
            run.startedAt,
            run.sets,
            run.finishedAt ?? Date.now(),
          );
          setActiveRun(null);
          onSave(
            entry,
            link,
            routineName !== undefined
              ? { name: routineName || title, steps: stepsFromSets(run.sets) }
              : undefined,
          );
          onClose();
        }}
        onDiscard={quit}
      />
    );
  }

  const picking = isPicking(run);
  const step = currentStep(run);
  const ex = step ? getExercise(step.ex) : undefined;
  if (!picking && (!step || !ex)) return null;

  const { done, total } = runProgress(run);

  const header = (
    <>
      <div className="mono-fit-player-top">
        <h2 className="mono-h3" id="fit-player-title">
          {title}
        </h2>
        <MonoBtn type="button" variant="ghost" onClick={() => setConfirmQuit(true)}>
          {t('fit.p.quit')}
        </MonoBtn>
      </div>
      {run.free ? (
        <p className="mono-meta mono-fit-small" data-testid="fit-free-count">
          {t('fit.free.count', { n: run.sets.length })}
        </p>
      ) : (
        <div
          className="mono-fit-progress"
          role="progressbar"
          aria-label={t('fit.p.progressAria')}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <span style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
        </div>
      )}

      <div className="mono-fit-sound" role="group" aria-label={t('fit.snd.aria')}>
        <MonoChip
          type="button"
          pressed={prefs.beeps}
          onClick={() => setPref('beeps', !prefs.beeps)}
        >
          {t('fit.snd.beeps')}
        </MonoChip>
        {voiceOk ? (
          <MonoChip
            type="button"
            pressed={prefs.voice}
            onClick={() => setPref('voice', !prefs.voice)}
          >
            {t('fit.snd.voice')}
          </MonoChip>
        ) : null}
        <MonoChip
          type="button"
          pressed={prefs.autoStart}
          onClick={() => setPref('autoStart', !prefs.autoStart)}
        >
          {t('fit.snd.auto')}
        </MonoChip>
      </div>

      {confirmQuit ? (
        <div className="mono-fit-confirm" role="group" aria-label={t('fit.p.quitAsk')}>
          <p className="mono-meta">{t('fit.p.quitAsk')}</p>
          <div className="mono-fit-actions">
            <MonoBtn type="button" variant="ghost" onClick={quit}>
              {t('fit.p.quit')}
            </MonoBtn>
            <MonoBtn type="button" onClick={() => setConfirmQuit(false)}>
              {t('fit.p.keep')}
            </MonoBtn>
          </div>
        </div>
      ) : null}
    </>
  );

  if (picking || !step || !ex) {
    return (
      <section
        className="mono-fit-player"
        aria-labelledby="fit-player-title"
        data-testid="fit-player"
      >
        {header}
        <div className="mono-fit-stage mono-fit-stage-pick">
          <p className="mono-eyebrow">
            {run.sets.length > 0 ? t('fit.free.next') : t('fit.free.first')}
          </p>
          <MonoExercisePicker
            place={place}
            label={t('fit.free.pickAria')}
            onPick={(id) => setRun(addFreeStep(run, id, log))}
          />
        </div>
        <div className="mono-fit-actions mono-fit-secondary">
          <MonoBtn type="button" onClick={() => setRun(finishRun(run, Date.now()))}>
            {t('fit.p.finish')}
          </MonoBtn>
        </div>
      </section>
    );
  }

  const name = t(fitKey.exName(ex.id));
  const upcoming = nextStep(run);
  const timed = run.timer !== undefined;
  const leading = leadUntil !== null;
  const running = run.timer?.endsAt !== undefined || leading;
  const left = timerLeftMs(run, now);
  const started = timed && left < setWorkSec(step) * 1000;
  const stepCount = runSteps(run).length;
  const weightPicks = WEIGHTED_GEAR.includes(ex.equipment) ? weights : [];

  const completeSet = () => {
    const at = Date.now();
    const set = timed ? timedSet(run, at) : repsSet(run);
    if (set) setRun(logSet(run, set, at, log));
  };

  return (
    <section
      className="mono-fit-player"
      aria-labelledby="fit-player-title"
      data-testid="fit-player"
    >
      {header}

      {run.phase === 'rest' ? (
        <div className="mono-fit-stage" data-testid="fit-rest">
          <p className="mono-eyebrow">{t('fit.p.rest')}</p>
          <p className="mono-fit-clock" role="timer">
            {clock(restLeftMs(run, now))}
          </p>
          <p className="mono-meta">{t('fit.p.next', { name })}</p>
          <div className="mono-fit-actions">
            <MonoBtn type="button" onClick={() => setRun(endRest(run))}>
              {t('fit.p.skipRest')}
            </MonoBtn>
          </div>
        </div>
      ) : (
        <div className="mono-fit-stage">
          <MonoExerciseIcon
            pose={ex.pose}
            pose2={ex.pose2}
            animate
            size={112}
            className="mono-fit-hero"
          />
          <p className="mono-eyebrow">
            {run.free ? '' : `${t('fit.p.step', { i: run.stepIdx + 1, n: stepCount })} · `}
            {t('fit.p.set', { i: run.setIdx + 1, n: step.sets })}
          </p>
          <h3 className="mono-h2">{name}</h3>
          <p className="mono-meta mono-fit-cue">{t(fitKey.exCue(ex.id))}</p>
          <p className="mono-fit-dose">
            {fitDose(t, { sets: step.sets, reps: step.reps, sec: step.sec, sides: ex.sides })}
          </p>

          {timed ? (
            <>
              {leading ? (
                <>
                  <p className="mono-eyebrow">{t('fit.p.getReady')}</p>
                  <p className="mono-fit-clock mono-fit-lead" role="timer" aria-live="assertive">
                    {Math.max(1, Math.ceil((leadUntil - now) / 1000))}
                  </p>
                </>
              ) : (
                <p className="mono-fit-clock" role="timer">
                  {clock(left)}
                </p>
              )}
              {shouldSwitchSides(run, now) ? (
                <p className="mono-fit-cue-strong" role="status">
                  {t('fit.p.switchSides')}
                </p>
              ) : null}
              <div className="mono-fit-actions">
                {running ? (
                  <MonoBtn
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      leading ? setLeadUntil(null) : setRun(pauseTimer(run, Date.now()))
                    }
                  >
                    {t('fit.p.pause')}
                  </MonoBtn>
                ) : (
                  <MonoBtn
                    type="button"
                    onClick={() => {
                      // A fresh hold gets a 3-2-1 when there is a sound to count with.
                      if (!started && (prefs.beeps || (prefs.voice && voiceOk))) {
                        setNow(Date.now());
                        setLeadUntil(Date.now() + LEAD_IN_MS);
                        say(t('fit.p.getReady'));
                      } else {
                        setRun(startTimer(run, Date.now()));
                      }
                    }}
                  >
                    {started ? t('fit.p.resume') : t('fit.p.startTimer')}
                  </MonoBtn>
                )}
                <MonoBtn
                  type="button"
                  variant={running ? 'primary' : 'ghost'}
                  onClick={completeSet}
                >
                  {t('fit.p.setDone')}
                </MonoBtn>
              </div>
              {ex.mode === 'reps' && (ex.type === 'strength' || ex.type === 'hiit') ? (
                <label className="mono-fit-label mono-fit-reps-opt">
                  <span className="mono-meta">{t('fit.p.repsOptional')}</span>
                  <input
                    className="mono-field"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1000}
                    value={run.reps}
                    onChange={(e) => setRun({ ...run, reps: e.target.value })}
                  />
                </label>
              ) : null}
            </>
          ) : (
            <>
              <div className="mono-fit-inputs">
                <label className="mono-fit-label">
                  <span className="mono-meta">{t('fit.p.reps')}</span>
                  <input
                    className="mono-field"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1000}
                    value={run.reps}
                    onChange={(e) => setRun({ ...run, reps: e.target.value })}
                  />
                </label>
                {ex.weighted ? (
                  <label className="mono-fit-label">
                    <span className="mono-meta">{t('fit.p.kg')}</span>
                    <input
                      className="mono-field"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={1000}
                      step={0.5}
                      value={run.kg}
                      onChange={(e) => setRun({ ...run, kg: e.target.value })}
                    />
                  </label>
                ) : null}
              </div>
              {ex.weighted && weightPicks.length > 0 ? (
                <div
                  className="mono-fit-weights"
                  role="group"
                  aria-label={t('fit.pack.weightsTitle')}
                >
                  {weightPicks.map((w) => (
                    <MonoChip
                      key={w}
                      type="button"
                      pressed={Number.parseFloat(run.kg.replace(',', '.')) === w}
                      onClick={() => setRun({ ...run, kg: String(w) })}
                    >
                      {t('fit.pack.kg', { n: fmtNum(w) })}
                    </MonoChip>
                  ))}
                </div>
              ) : null}
              <div className="mono-fit-actions">
                <MonoBtn type="button" onClick={completeSet}>
                  {t('fit.p.setDone')}
                </MonoBtn>
              </div>
            </>
          )}

          {upcoming && run.setIdx + 1 >= step.sets ? (
            <p className="mono-meta">{t('fit.p.next', { name: t(fitKey.exName(upcoming.ex)) })}</p>
          ) : null}
        </div>
      )}

      <div className="mono-fit-actions mono-fit-secondary">
        {run.phase === 'work' ? (
          <MonoBtn
            type="button"
            variant="ghost"
            onClick={() => setRun(skipExercise(run, Date.now(), log))}
          >
            {t('fit.p.skipEx')}
          </MonoBtn>
        ) : null}
        <MonoBtn type="button" variant="ghost" onClick={() => setRun(finishRun(run, Date.now()))}>
          {t('fit.p.finish')}
        </MonoBtn>
      </div>
    </section>
  );
}

function DoneView({
  run,
  title,
  icon,
  habits,
  preferredHabitId,
  isPro,
  canSaveRoutine,
  onSave,
  onDiscard,
}: {
  run: RunState;
  title: string;
  icon?: PoseId;
  habits: Habit[];
  preferredHabitId?: string;
  isPro: boolean;
  canSaveRoutine: boolean;
  /** `routineName` is set when the workout should also become a routine. */
  onSave: (link: HabitLink, routineName?: string) => void;
  onDiscard: () => void;
}) {
  const { t, fmtDur } = useI18n();
  const active = useMemo(() => activeHabits(habits), [habits]);
  const canCreate = isPro || active.length < FREE_HABITS_LIMIT;
  const suggested = findFitnessHabit(habits, preferredHabitId);
  const [choice, setChoice] = useState<string>(suggested?.id ?? (canCreate ? 'new' : ''));
  const [asRoutine, setAsRoutine] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const habitName = t('fit.d.habitName');
  const durSec = Math.max(
    0,
    Math.round(((run.finishedAt ?? run.startedAt) - run.startedAt) / 1000),
  );
  const hasSets = run.sets.length > 0;

  const save = () => {
    const name = isPro && canSaveRoutine && asRoutine ? routineName.trim() : undefined;
    if (choice === 'new') onSave({ kind: 'create', name: habitName }, name);
    else if (choice) onSave({ kind: 'habit', id: choice }, name);
    else onSave({ kind: 'none' }, name);
  };

  return (
    <section
      className="mono-fit-player mono-fit-done"
      aria-labelledby="fit-done-title"
      data-testid="fit-done"
    >
      {icon ? <MonoExerciseIcon pose={icon} size={96} className="mono-fit-hero" /> : null}
      <h2 className="mono-h2" id="fit-done-title">
        {t('fit.d.title')}
      </h2>
      <p className="mono-meta">{title}</p>
      {hasSets ? (
        <>
          <p className="mono-fit-dose">
            {t('fit.d.stats', {
              dur: fmtDur(Math.max(1, Math.round(durSec / 60))),
              sets: run.sets.length,
            })}
          </p>
          <label className="mono-fit-label mono-fit-habit">
            <span className="mono-meta">{t('fit.d.habit')}</span>
            <select
              className="mono-field"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              {active.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.icon ? `${h.icon} ${h.name}` : h.name}
                </option>
              ))}
              {canCreate ? (
                <option value="new">{t('fit.d.createHabit', { name: habitName })}</option>
              ) : null}
              <option value="">{t('fit.d.noHabit')}</option>
            </select>
          </label>
          {!canCreate && !suggested ? (
            <p className="mono-meta" role="note">
              {t('fit.d.habitLimit')}
            </p>
          ) : null}
          {canSaveRoutine ? (
            isPro ? (
              <div className="mono-fit-saveas">
                <label className="mono-fit-check">
                  <input
                    type="checkbox"
                    checked={asRoutine}
                    onChange={(e) => setAsRoutine(e.target.checked)}
                  />
                  <span className="mono-meta">{t('fit.d.saveRoutine')}</span>
                </label>
                {asRoutine ? (
                  <label className="mono-fit-label">
                    <span className="mono-meta">{t('fit.b.name')}</span>
                    <input
                      className="mono-field"
                      value={routineName}
                      maxLength={MAX_ROUTINE_NAME}
                      placeholder={t('fit.b.namePh')}
                      onChange={(e) => setRoutineName(e.target.value)}
                    />
                  </label>
                ) : null}
              </div>
            ) : (
              <p className="mono-meta mono-fit-small" role="note">
                {t('fit.d.routinePro')}
              </p>
            )
          ) : null}
        </>
      ) : (
        <p className="mono-meta">{t('fit.d.nothing')}</p>
      )}
      <div className="mono-fit-actions">
        {hasSets ? (
          <MonoBtn type="button" onClick={save}>
            {t('fit.d.save')}
          </MonoBtn>
        ) : null}
        <MonoBtn type="button" variant="ghost" onClick={onDiscard}>
          {t('fit.d.discard')}
        </MonoBtn>
      </div>
    </section>
  );
}
