import { useState, type ReactNode } from 'react';
import MonoBtn from './MonoBtn';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import { FIT_PLACES, fitKey, type FitLevel } from '../lib/fitness/library';
import {
  DEFAULT_ANSWERS,
  PROGRAM_DAYS,
  PROGRAM_GEAR,
  PROGRAM_GOALS,
  PROGRAM_MINUTES,
  PROGRAM_WEEKS,
  type ProgramAnswers,
} from '../lib/fitness/program';

interface Props {
  initial?: ProgramAnswers;
  onSave: (answers: ProgramAnswers) => void;
  onCancel: () => void;
}

const LEVELS: readonly FitLevel[] = [1, 2, 3];

/** Six questions (goal, level, place, equipment, days, minutes) plus length. */
export default function MonoProgramSetup({ initial, onSave, onCancel }: Props) {
  const { t, fmtNum } = useI18n();
  const [a, setA] = useState<ProgramAnswers>(initial ?? DEFAULT_ANSWERS);
  const set = (p: Partial<ProgramAnswers>) => setA((cur) => ({ ...cur, ...p }));
  const toggleGear = (g: ProgramAnswers['gear'][number]) =>
    set({ gear: a.gear.includes(g) ? a.gear.filter((x) => x !== g) : [...a.gear, g] });

  const group = (id: string, label: string, children: ReactNode, note?: string) => (
    <fieldset className="mono-fit-q" aria-labelledby={id}>
      <legend className="mono-h3" id={id}>
        {label}
      </legend>
      <div className="mono-fit-filters">{children}</div>
      {note ? <p className="mono-meta mono-fit-small">{note}</p> : null}
    </fieldset>
  );
  const chip = (key: string, pressed: boolean, onClick: () => void, text: string) => (
    <button key={key} type="button" className="mono-chip" aria-pressed={pressed} onClick={onClick}>
      {text}
    </button>
  );

  return (
    <section
      className="mono-fit-builder"
      data-testid="fit-pp-setup"
      aria-labelledby="fit-pp-s-title"
    >
      <button type="button" className="mono-link-btn mono-fit-back" onClick={onCancel}>
        ‹ {t('fit.b.cancel')}
      </button>
      <h2 className="mono-h2" id="fit-pp-s-title">
        {t('fit.pp.setupTitle')}
      </h2>
      <p className="mono-meta">{t('fit.pp.setupSub')}</p>

      {group(
        'fit-pp-q-goal',
        t('fit.pp.q.goal'),
        PROGRAM_GOALS.map((g) =>
          chip(g, a.goal === g, () => set({ goal: g }), t(`fit.pp.goal.${g}` as TKey)),
        ),
      )}
      {group(
        'fit-pp-q-level',
        t('fit.pp.q.level'),
        LEVELS.map((l) =>
          chip(String(l), a.level === l, () => set({ level: l }), t(fitKey.level(l))),
        ),
      )}
      {group(
        'fit-pp-q-place',
        t('fit.pp.q.place'),
        FIT_PLACES.map((p) => chip(p, a.place === p, () => set({ place: p }), t(fitKey.place(p)))),
      )}
      {a.place === 'gym'
        ? null
        : group(
            'fit-pp-q-gear',
            t('fit.pp.q.gear'),
            PROGRAM_GEAR.map((g) =>
              chip(g, a.gear.includes(g), () => toggleGear(g), t(fitKey.eq(g))),
            ),
            t('fit.pp.gearNote'),
          )}
      {group(
        'fit-pp-q-days',
        t('fit.pp.q.days'),
        PROGRAM_DAYS.map((d) => chip(String(d), a.days === d, () => set({ days: d }), fmtNum(d))),
      )}
      {group(
        'fit-pp-q-min',
        t('fit.pp.q.minutes'),
        PROGRAM_MINUTES.map((m) =>
          chip(String(m), a.minutes === m, () => set({ minutes: m }), t('fit.pp.min', { n: m })),
        ),
      )}
      {group(
        'fit-pp-q-weeks',
        t('fit.pp.q.weeks'),
        PROGRAM_WEEKS.map((w) =>
          chip(String(w), a.weeks === w, () => set({ weeks: w }), fmtNum(w)),
        ),
      )}

      <p className="mono-meta mono-fit-num">
        {t('fit.pp.summary', { days: a.days, min: a.minutes, weeks: a.weeks })}
      </p>
      <div className="mono-fit-actions mono-fit-builder-foot">
        <MonoBtn type="button" onClick={() => onSave(a)}>
          {initial ? t('fit.pp.update') : t('fit.pp.create')}
        </MonoBtn>
        <MonoBtn type="button" variant="ghost" onClick={onCancel}>
          {t('fit.b.cancel')}
        </MonoBtn>
      </div>
    </section>
  );
}
