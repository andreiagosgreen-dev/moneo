import { memo } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import { RANKS, XP_RULES, type XpBreakdown, levelFromXp } from '../lib/xp';
import type { Badge } from '../lib/badges';
import { RANK_KEYS, rankLabel } from './rankLabel';
import MonoBadgeGrid from './MonoBadgeGrid';

interface Props {
  xp: XpBreakdown;
  badges?: Badge[];
}

const RING_R = 28;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Rank + level + progress to the next level, with a short "how you earn XP"
 * explainer. Pure view over the derived XP breakdown — nothing stored here.
 */
function MonoRankCardBase({ xp, badges }: Props) {
  const { t, fmtNum, fmtDur } = useI18n();
  const info = levelFromXp(xp.total);
  const pct = Math.round(info.progress * 100);
  const left = info.span - info.into;

  const rules: Array<{ id: string; text: string; earned: number }> = [
    {
      id: 'focus',
      text: t('mono.xp.rule.focus', { cap: fmtDur(XP_RULES.focusDailyCapMin) }),
      earned: xp.focus,
    },
    {
      id: 'tasks',
      text: t('mono.xp.rule.task', {
        n: XP_RULES.task,
        m: XP_RULES.milestoneTask,
        cap: XP_RULES.taskDailyCap,
      }),
      earned: xp.tasks,
    },
    {
      id: 'habits',
      text: t('mono.xp.rule.habit', { n: XP_RULES.habitCheckIn }),
      earned: xp.habits,
    },
    { id: 'phases', text: t('mono.xp.rule.phase', { n: XP_RULES.phase }), earned: xp.phases },
    {
      id: 'projects',
      text: t('mono.xp.rule.project', { n: XP_RULES.project, min: XP_RULES.projectMinItems }),
      earned: xp.projects,
    },
  ];

  return (
    <section
      className="mono-card mono-rank"
      aria-label={t('mono.xp.eyebrow')}
      data-testid="rank-card"
    >
      <div className="mono-rank-main">
        <div
          className="mono-rank-ring"
          role="img"
          aria-label={t('mono.xp.progressAria', { level: fmtNum(info.level + 1), pct })}
        >
          <svg viewBox="0 0 64 64" aria-hidden>
            <circle className="mono-rank-track" cx="32" cy="32" r={RING_R} />
            <circle
              className="mono-rank-bar"
              cx="32"
              cy="32"
              r={RING_R}
              strokeDasharray={`${RING_C * Math.max(0.015, info.progress)} ${RING_C}`}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <span className="mono-rank-level">
            <small>{t('mono.xp.lvl')}</small>
            {fmtNum(info.level)}
          </span>
        </div>
        <div className="mono-rank-copy">
          <p className="mono-eyebrow">{t('mono.xp.eyebrow')}</p>
          <h3 className="mono-h2 mono-rank-name">{rankLabel(t, info.level)}</h3>
          <p className="mono-meta">
            {t('mono.xp.levelLine', { n: fmtNum(info.level), xp: fmtNum(xp.total) })}
          </p>
          <p className="mono-meta mono-rank-next">
            {t('mono.xp.toNext', { n: fmtNum(left), level: fmtNum(info.level + 1) })}
          </p>
        </div>
      </div>

      {badges && badges.length > 0 && <MonoBadgeGrid badges={badges} />}

      <details className="mono-rank-how">
        <summary>{t('mono.xp.howTitle')}</summary>
        <p className="mono-meta">{t('mono.xp.howIntro')}</p>
        <ul>
          {rules.map((r) => (
            <li key={r.id}>
              <span>{r.text}</span>
              <span className="mono-rank-earned">{t('mono.xp.xp', { n: fmtNum(r.earned) })}</span>
            </li>
          ))}
        </ul>
        <p className="mono-meta">
          {t('mono.xp.ranksLine', { ranks: RANKS.map((r) => t(RANK_KEYS[r.id])).join(' → ') })}
        </p>
        <p className="mono-meta mono-rank-note">{t('mono.xp.deviceNote')}</p>
      </details>
    </section>
  );
}

const MonoRankCard = memo(MonoRankCardBase);
export default MonoRankCard;
