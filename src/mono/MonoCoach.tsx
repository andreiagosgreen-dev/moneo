import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import {
  COACH_EXAMPLE_COUNT,
  dismissCoach,
  isCoachDismissed,
  showCoachAgain,
  type ProgramCoachKind,
} from '../lib/guidance/programCoach';
import MonoChip from './MonoChip';
import MonoBtn from './MonoBtn';

interface Props {
  kind: ProgramCoachKind;
  dayKey: string;
  /** Prefill / apply an example chip. */
  onExample?: (text: string) => void;
  /** Optional primary action (go work, write plan, shutdown). */
  onCta?: () => void;
  ctaLabel?: string;
}

const Q: Record<ProgramCoachKind, TKey> = {
  aziEmpty: 'mono.coach.aziEmpty.q',
  aziOpen: 'mono.coach.aziOpen.q',
  aziDone: 'mono.coach.aziDone.q',
  focusEmpty: 'mono.coach.focusEmpty.q',
  focusOpen: 'mono.coach.focusOpen.q',
  orarEmpty: 'mono.coach.orarEmpty.q',
  orarHas: 'mono.coach.orarHas.q',
};

const HINT: Record<ProgramCoachKind, TKey> = {
  aziEmpty: 'mono.coach.aziEmpty.hint',
  aziOpen: 'mono.coach.aziOpen.hint',
  aziDone: 'mono.coach.aziDone.hint',
  focusEmpty: 'mono.coach.focusEmpty.hint',
  focusOpen: 'mono.coach.focusOpen.hint',
  orarEmpty: 'mono.coach.orarEmpty.hint',
  orarHas: 'mono.coach.orarHas.hint',
};

const EX: Record<ProgramCoachKind, TKey[]> = {
  aziEmpty: ['mono.coach.aziEmpty.ex1', 'mono.coach.aziEmpty.ex2', 'mono.coach.aziEmpty.ex3'],
  aziOpen: [],
  aziDone: [],
  focusEmpty: [],
  focusOpen: ['mono.coach.focusOpen.ex1', 'mono.coach.focusOpen.ex2'],
  orarEmpty: ['mono.coach.orarEmpty.ex1', 'mono.coach.orarEmpty.ex2'],
  orarHas: [],
};

/** Quiet guidance card: one question, one hint, optional example chips + CTA. */
export default function MonoCoach({ kind, dayKey, onExample, onCta, ctaLabel }: Props) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(() => isCoachDismissed(dayKey, kind));

  useEffect(() => {
    setHidden(isCoachDismissed(dayKey, kind));
  }, [dayKey, kind]);

  if (hidden) {
    return (
      <div className="mono-coach-restore">
        <button
          type="button"
          className="mono-coach-dismiss"
          onClick={() => {
            showCoachAgain(dayKey, kind);
            setHidden(false);
          }}
        >
          {t('mono.coach.show')}
        </button>
      </div>
    );
  }

  const examples = EX[kind].slice(0, COACH_EXAMPLE_COUNT[kind]);

  return (
    <aside className="mono-coach" aria-label={t('mono.coach.label')}>
      <div className="mono-coach-top">
        <p className="mono-eyebrow">{t('mono.coach.label')}</p>
        <button
          type="button"
          className="mono-coach-dismiss"
          onClick={() => {
            dismissCoach(dayKey, kind);
            setHidden(true);
          }}
        >
          {t('mono.coach.dismiss')}
        </button>
      </div>
      <p className="mono-h3" style={{ marginTop: 6 }}>
        {t(Q[kind])}
      </p>
      <p className="mono-meta" style={{ marginTop: 6 }}>
        {t(HINT[kind])}
      </p>
      {examples.length > 0 ? (
        <div className="mono-coach-examples" role="group" aria-label={t('mono.coach.examples')}>
          {examples.map((key) => {
            const text = t(key);
            return (
              <MonoChip key={key} type="button" onClick={() => onExample?.(text)}>
                {text}
              </MonoChip>
            );
          })}
        </div>
      ) : null}
      {onCta && ctaLabel ? (
        <div style={{ marginTop: 12 }}>
          <MonoBtn type="button" variant="primary" onClick={onCta} block>
            {ctaLabel}
          </MonoBtn>
        </div>
      ) : null}
    </aside>
  );
}
