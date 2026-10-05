import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TrialNotice } from '../lib/billing/signupTrial';

/** Today: the free Pro trial is about to end, or just ended. */
export default function MonoTrialNote({ notice }: { notice: Exclude<TrialNotice, null> }) {
  const { t } = useI18n();
  return (
    <div className="mono-card mono-trial-note" role="status" data-testid="trial-note">
      <p className="mono-h3">
        {notice.kind === 'left'
          ? notice.days === 1
            ? t('mono.trial.lastDay')
            : t('mono.trial.left', { n: notice.days })
          : t('mono.trial.ended')}
      </p>
      <p className="mono-meta">
        {notice.kind === 'left' ? t('mono.trial.leftSub') : t('mono.trial.endedSub')}
      </p>
      <Link to="/pricing" className="mono-link-btn">
        {t('mono.trial.cta')}
      </Link>
    </div>
  );
}
