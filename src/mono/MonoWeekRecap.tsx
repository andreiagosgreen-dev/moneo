import MonoCard from './MonoCard';
import MonoBtn from './MonoBtn';
import MonoStat from './MonoStat';
import MonoTag from './MonoTag';
import { badgeNameKey } from './badgeLabel';
import type { LastWeekRecap } from '../lib/weekRecap';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  recap: LastWeekRecap;
  onDismiss: () => void;
  onOpenReports: () => void;
}

/** Dismissible "last week" summary shown on Today at the start of a week. */
export default function MonoWeekRecap({ recap, onDismiss, onOpenReports }: Props) {
  const { t, fmtNum, fmtDur, fmtDayKey } = useI18n();
  const range = `${fmtDayKey(recap.start)} – ${fmtDayKey(recap.end)}`;

  return (
    <MonoCard>
      <div className="mono-recap" data-testid="week-recap">
        <div className="mono-between" style={{ gap: 8 }}>
          <p className="mono-eyebrow" style={{ marginBottom: 0 }}>
            {t('mono.recap.eyebrow', { range })}
          </p>
          <button
            type="button"
            className="mono-week-nav mono-recap-close"
            aria-label={t('mono.recap.dismiss')}
            onClick={onDismiss}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
            </svg>
          </button>
        </div>
        <h3 className="mono-h3" style={{ margin: '2px 0 12px' }}>
          {t('mono.recap.title')}
        </h3>
        <div className="mono-recap-stats">
          <MonoStat value={fmtDur(recap.focusMin)} caption={t('mono.recap.focus')} />
          <MonoStat value={fmtNum(recap.tasksDone)} caption={t('mono.recap.tasks')} />
          <MonoStat value={`+${fmtNum(recap.xpGained)}`} caption={t('mono.recap.xp')} />
          <MonoStat value={fmtNum(recap.habitCheckins)} caption={t('mono.recap.habits')} />
        </div>
        {recap.newBadges.length > 0 ? (
          <div className="mono-recap-badges">
            <span className="mono-meta">{t('mono.recap.badges')}</span>
            {recap.newBadges.map((id) => (
              <MonoTag key={id} tone="accent">
                {t(badgeNameKey(id))}
              </MonoTag>
            ))}
          </div>
        ) : null}
        {recap.bestDay ? (
          <p className="mono-meta" style={{ marginTop: 10 }}>
            {t('mono.recap.bestDay', {
              day: fmtDayKey(recap.bestDay.key),
              dur: fmtDur(recap.bestDay.min),
            })}
          </p>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <MonoBtn variant="ghost" onClick={onOpenReports}>
            {t('mono.recap.open')}
          </MonoBtn>
        </div>
      </div>
    </MonoCard>
  );
}
