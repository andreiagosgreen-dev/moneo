import { useMemo, useState } from 'react';
import MonoBtn from './MonoBtn';
import MonoExerciseIcon from './MonoExerciseIcon';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import { routineMinutes } from '../lib/fitness/library';
import { resolveRoutine, routineTitle } from '../lib/fitness/custom';
import {
  isProgramFinished,
  isProgramId,
  mondayOf,
  programRoutineId,
  programSchedule,
  programWeek,
} from '../lib/fitness/program';
import type { WorkoutStore } from '../lib/fitness/workouts';

interface Props {
  store: WorkoutStore;
  isPro: boolean;
  onStart: (routineId: string) => void;
  onSetup: () => void;
  onEnd: () => void;
}

/** "My program" section: Pro teaser, build button, or this week's sessions. */
export default function MonoProgram({ store, isPro, onStart, onSetup, onEnd }: Props) {
  const { t, tag, fmtNum } = useI18n();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' }),
    [tag],
  );
  const dayName = (d: number) => dayFmt.format(Date.UTC(2024, 0, d === 0 ? 7 : d));
  const program = store.program;
  const now = Date.now();

  const title = (
    <h2 className="mono-h3" id="fit-pp-title">
      {t('fit.pp.title')}
      {isPro ? '' : ' · Pro'}
    </h2>
  );

  const endControls = confirmEnd ? (
    <div className="mono-fit-confirm" role="group" aria-label={t('fit.pp.endAsk')}>
      <p className="mono-meta">{t('fit.pp.endAsk')}</p>
      <div className="mono-fit-actions">
        <MonoBtn
          type="button"
          variant="ghost"
          onClick={() => {
            setConfirmEnd(false);
            onEnd();
          }}
        >
          {t('fit.pp.end')}
        </MonoBtn>
        <MonoBtn type="button" onClick={() => setConfirmEnd(false)}>
          {t('fit.b.cancel')}
        </MonoBtn>
      </div>
    </div>
  ) : (
    <button
      type="button"
      className="mono-link-btn mono-fit-danger"
      onClick={() => setConfirmEnd(true)}
    >
      {t('fit.pp.end')}
    </button>
  );

  if (!program) {
    return (
      <section className="mono-sec" aria-labelledby="fit-pp-title" data-testid="fit-pp">
        {title}
        <p className="mono-meta">{t('fit.pp.sub')}</p>
        {isPro ? (
          <MonoBtn type="button" onClick={onSetup}>
            {t('fit.pp.build')}
          </MonoBtn>
        ) : (
          <p className="mono-note" data-testid="fit-pp-pro">
            {t('fit.pp.pro')}
          </p>
        )}
      </section>
    );
  }

  const weeks = program.answers.weeks;
  if (isProgramFinished(program, now)) {
    return (
      <section className="mono-sec" aria-labelledby="fit-pp-title" data-testid="fit-pp">
        {title}
        <div className="mono-card mono-fit-pp" data-testid="fit-pp-done">
          <p className="mono-fit-name">{t('fit.pp.doneTitle')}</p>
          <p className="mono-meta">{t('fit.pp.doneText', { weeks })}</p>
          {isPro ? (
            <MonoBtn type="button" onClick={onSetup}>
              {t('fit.pp.next')}
            </MonoBtn>
          ) : null}
          {endControls}
        </div>
      </section>
    );
  }

  const week = Math.max(0, programWeek(program, now));
  const from = mondayOf(now);
  const doneThisWeek = store.log.filter(
    (e) => isProgramId(e.routineId) && e.startedAt >= from && e.startedAt <= now,
  ).length;
  const schedule = [...programSchedule(program).entries()];

  return (
    <section className="mono-sec" aria-labelledby="fit-pp-title" data-testid="fit-pp">
      {title}
      <div className="mono-card mono-fit-pp" data-testid="fit-pp-active">
        <p className="mono-eyebrow">{t(`fit.pp.goal.${program.answers.goal}` as TKey)}</p>
        <p className="mono-h2 mono-fit-num">{t('fit.pp.week', { w: week + 1, n: weeks })}</p>
        <div
          className="mono-fit-pp-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={weeks}
          aria-valuenow={week + 1}
          aria-label={t('fit.pp.week', { w: week + 1, n: weeks })}
        >
          <i style={{ width: `${Math.round(((week + 1) / weeks) * 100)}%` }} />
        </div>
        <p className="mono-meta mono-fit-num">
          {t('fit.pp.weekDone', {
            done: fmtNum(Math.min(doneThisWeek, program.weekdays.length)),
            total: fmtNum(program.weekdays.length),
          })}
        </p>
        <p className="mono-meta mono-fit-small">{t('fit.pp.progression')}</p>
      </div>
      <ul className="mono-fit-grid" data-testid="fit-pp-sessions">
        {program.sessions.map((s) => {
          const id = programRoutineId(s.key);
          const r = resolveRoutine(store, id, now);
          if (!r) return null;
          const name = routineTitle(t, store, id);
          const days = schedule.filter(([, sid]) => sid === id).map(([d]) => d);
          return (
            <li key={id} className="mono-fit-card" data-testid={`fit-rt-${id}`}>
              <MonoExerciseIcon pose={r.icon} size={44} />
              <div className="mono-fit-card-copy">
                <p className="mono-fit-name">{name}</p>
                <p className="mono-meta mono-fit-small mono-fit-num">
                  {t('fit.routineMeta', { min: routineMinutes(r), n: r.steps.length })}
                </p>
                {days.length > 0 ? (
                  <p className="mono-fit-small mono-fit-planned">
                    {t('fit.plan.on', { days: days.map(dayName).join(', ') })}
                  </p>
                ) : null}
                <div className="mono-fit-card-foot">
                  <MonoBtn
                    type="button"
                    aria-label={t('fit.startAria', { name })}
                    onClick={() => onStart(id)}
                  >
                    {t('fit.start')}
                  </MonoBtn>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mono-fit-pp-foot">
        {isPro ? (
          <button type="button" className="mono-link-btn" onClick={onSetup}>
            {t('fit.pp.edit')}
          </button>
        ) : null}
        {endControls}
      </div>
    </section>
  );
}
