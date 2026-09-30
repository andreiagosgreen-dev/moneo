import { useMemo } from 'react';
import MonoExerciseIcon from './MonoExerciseIcon';
import MonoBodyMap, { type HeatLevel } from './MonoBodyMap';
import MonoProgressChart from './MonoProgressChart';
import { holdClock, recordText } from './MonoFitRecords';
import { fitDose } from './MonoWorkoutPlayer';
import { useI18n } from '../lib/i18n/LocaleContext';
import {
  exerciseAlternatives,
  exerciseSteps,
  fitKey,
  type Exercise,
  type Muscle,
} from '../lib/fitness/library';
import { exerciseBests, exerciseProgress, progressKind } from '../lib/fitness/records';
import type { WorkoutEntry } from '../lib/fitness/workouts';

interface Props {
  ex: Exercise;
  onBack: () => void;
  onOpen: (id: string) => void;
  log?: WorkoutEntry[];
  isPro?: boolean;
}

/** One exercise, learnable on the spot: demo, muscles, how-to, mistake, swaps. */
export default function MonoExerciseDetail({ ex, onBack, onOpen, log = [], isPro = false }: Props) {
  const { t, fmtNum } = useI18n();
  const best = useMemo(() => exerciseBests(log).get(ex.id), [log, ex.id]);
  const kind = progressKind(best);
  const points = useMemo(
    () => (kind ? exerciseProgress(log, ex.id, kind) : []),
    [log, ex.id, kind],
  );
  const name = t(fitKey.exName(ex.id));
  const [main, ...secondary] = ex.muscles;
  const levels: Partial<Record<Muscle, HeatLevel>> = { [main]: 3 };
  for (const m of secondary) levels[m] = 1;
  const { easier, harder } = exerciseSteps(ex);
  const alts = exerciseAlternatives(ex);
  const places = ex.places.map((p) => t(fitKey.place(p))).join(', ');

  const row = (e: Exercise, label?: string) => (
    <li key={`${label ?? ''}${e.id}`}>
      <button
        type="button"
        className="mono-fit-row mono-fit-rowbtn"
        aria-label={t('fit.lib.openAria', { name: t(fitKey.exName(e.id)) })}
        onClick={() => onOpen(e.id)}
      >
        <MonoExerciseIcon pose={e.pose} size={40} />
        <span className="mono-fit-row-copy">
          {label ? <span className="mono-eyebrow">{label}</span> : null}
          <span className="mono-fit-name">{t(fitKey.exName(e.id))}</span>
          <span className="mono-meta mono-fit-small">
            {e.places.map((p) => t(fitKey.place(p))).join(', ')} · {t(fitKey.eq(e.equipment))}
          </span>
        </span>
        <span className="mono-tpl-chev" aria-hidden>
          ›
        </span>
      </button>
    </li>
  );

  return (
    <article className="mono-fit-detail" data-testid="fit-detail" aria-labelledby="fit-x-name">
      <button type="button" className="mono-link-btn mono-fit-back" onClick={onBack}>
        ‹ {t('fit.x.back')}
      </button>

      <div className="mono-card mono-fit-x-hero">
        <MonoExerciseIcon
          pose={ex.pose}
          pose2={ex.pose2}
          animate
          size={168}
          className="mono-fit-hero"
        />
      </div>

      <h2 className="mono-h2" id="fit-x-name">
        {name}
      </h2>
      <p className="mono-meta">
        {t(fitKey.type(ex.type))} · {t(fitKey.level(ex.level))} · {fitDose(t, ex)}
      </p>
      <div className="mono-fit-x-tags">
        <span className="mono-tag">{t(fitKey.eq(ex.equipment))}</span>
        <span className="mono-tag">{t('fit.x.places', { places })}</span>
      </div>

      {best && kind ? (
        <section className="mono-sec" aria-labelledby="fit-x-prog" data-testid="fit-x-progress">
          <h3 className="mono-h3" id="fit-x-prog">
            {t('fit.prog.title')}
            {isPro ? '' : ' · Pro'}
          </h3>
          {isPro ? (
            <>
              <p className="mono-fit-name">
                {t('fit.prog.best', { value: recordText(t, fmtNum, kind, best[kind]!) })}
              </p>
              {points.length >= 2 ? (
                <MonoProgressChart
                  points={points}
                  format={(v) => (kind === 'sec' ? holdClock(v) : fmtNum(v))}
                  label={t('fit.prog.aria', {
                    metric: t(`fit.prog.${kind}` as const),
                    from: kind === 'sec' ? holdClock(points[0].value) : fmtNum(points[0].value),
                    to:
                      kind === 'sec'
                        ? holdClock(points[points.length - 1].value)
                        : fmtNum(points[points.length - 1].value),
                    n: points.length,
                  })}
                />
              ) : (
                <p className="mono-meta">{t('fit.prog.one')}</p>
              )}
              <p className="mono-meta mono-fit-small">{t(`fit.prog.${kind}` as const)}</p>
            </>
          ) : (
            <p className="mono-note">{t('fit.prog.pro')}</p>
          )}
        </section>
      ) : null}

      <section className="mono-sec" aria-labelledby="fit-x-muscles">
        <h3 className="mono-h3" id="fit-x-muscles">
          {t('fit.x.muscles')}
        </h3>
        <div className="mono-fit-x-muscles">
          <MonoBodyMap
            levels={levels}
            label={t('fit.x.musclesAria', { name })}
            className="mono-bmap-sm"
          />
          <dl className="mono-fit-x-dl">
            <dt className="mono-eyebrow">{t('fit.x.primary')}</dt>
            <dd className="mono-fit-name">{t(fitKey.muscle(main))}</dd>
            {secondary.length > 0 ? (
              <>
                <dt className="mono-eyebrow">{t('fit.x.secondary')}</dt>
                <dd className="mono-meta">
                  {secondary.map((m) => t(fitKey.muscle(m))).join(', ')}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      </section>

      <section className="mono-sec" aria-labelledby="fit-x-how">
        <h3 className="mono-h3" id="fit-x-how">
          {t('fit.x.how')}
        </h3>
        <p className="mono-fit-x-text">{t(fitKey.exCue(ex.id))}</p>
        <p className="mono-note mono-fit-x-tip">
          <strong>{t('fit.x.mistake')}:</strong> {t(fitKey.exTip(ex.id))}
        </p>
      </section>

      {easier || harder ? (
        <section className="mono-sec" aria-labelledby="fit-x-steps">
          <h3 className="mono-h3" id="fit-x-steps">
            {t('fit.x.variants')}
          </h3>
          <ul className="mono-fit-list">
            {easier ? row(easier, t('fit.x.easier')) : null}
            {harder ? row(harder, t('fit.x.harder')) : null}
          </ul>
        </section>
      ) : null}

      {alts.length > 0 ? (
        <section className="mono-sec" aria-labelledby="fit-x-alts">
          <h3 className="mono-h3" id="fit-x-alts">
            {t('fit.x.alts')}
          </h3>
          <p className="mono-meta">{t('fit.x.altsSub')}</p>
          <ul className="mono-fit-list">{alts.map((e) => row(e))}</ul>
        </section>
      ) : null}
    </article>
  );
}
