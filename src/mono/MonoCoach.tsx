import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import {
  dismissCoach,
  isCoachDismissed,
  showCoachAgain,
  type ProgramCoachKind,
} from '../lib/guidance/programCoach';
import MonoBtn from './MonoBtn';

interface Props {
  kind: ProgramCoachKind;
  dayKey: string;
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

/** Quiet guidance card: one question, one hint, optional CTA. */
export default function MonoCoach({ kind, dayKey, onCta, ctaLabel }: Props) {
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
