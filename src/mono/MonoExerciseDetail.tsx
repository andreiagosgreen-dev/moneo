import MonoExerciseIcon from './MonoExerciseIcon';
import MonoBodyMap, { type HeatLevel } from './MonoBodyMap';
import { fitDose } from './MonoWorkoutPlayer';
import { useI18n } from '../lib/i18n/LocaleContext';
import {
  exerciseAlternatives,
  exerciseSteps,
  fitKey,
  type Exercise,
  type Muscle,
} from '../lib/fitness/library';

interface Props {
  ex: Exercise;
  onBack: () => void;
  onOpen: (id: string) => void;
}

/** One exercise, learnable on the spot: demo, muscles, how-to, mistake, swaps. */
export default function MonoExerciseDetail({ ex, onBack, onOpen }: Props) {
  const { t } = useI18n();
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
