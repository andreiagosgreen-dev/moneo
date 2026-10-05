import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TrialNotice } from '../lib/billing/signupTrial';

/** Today: the free Pro trial is about to end, or just ended. */
export interface TrialSummary {
  focusMin: number;
  sessions: number;
  workouts: number;
}

export default function MonoTrialNote({
  notice,
  summary,
}: {
  notice: Exclude<TrialNotice, null>;
  /** What the user did since sign-up, shown in the last days of the trial. */
  summary?: TrialSummary;
}) {
  const { t, fmtDur, fmtNum } = useI18n();
  const showSummary =
    notice.kind === 'left' && !!summary && (summary.sessions > 0 || summary.workouts > 0);
  return (
    <div className="mono-card mono-trial-note" role="status" data-testid="trial-note">
      <p className="mono-h3">
        {notice.kind === 'left'
          ? notice.days === 1
            ? t('mono.trial.lastDay')
            : t('mono.trial.left', { n: notice.days })
          : t('mono.trial.ended')}
      </p>
      {showSummary ? (
        <p className="mono-fit-name" data-testid="trial-summary">
          {t('mono.trial.summary', {
            focus: fmtDur(summary!.focusMin),
            sessions: fmtNum(summary!.sessions),
            workouts: fmtNum(summary!.workouts),
          })}
        </p>
      ) : null}
      <p className="mono-meta">
        {notice.kind === 'left' ? t('mono.trial.leftSub') : t('mono.trial.endedSub')}
      </p>
      <Link to="/pricing" className="mono-link-btn">
        {t('mono.trial.cta')}
      </Link>
    </div>
  );
}
