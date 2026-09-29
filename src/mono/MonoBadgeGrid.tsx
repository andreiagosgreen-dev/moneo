import { useI18n } from '../lib/i18n/LocaleContext';
import type { Badge, BadgeId } from '../lib/badges';
import { RANKS, XP_RULES } from '../lib/xp';
import { RANK_KEYS } from './rankLabel';
import { BADGE_KEYS, isRankBadge } from './badgeLabel';

/** Compact grid of earned (highlighted) and locked (dimmed, with how-to) badges. */
export default function MonoBadgeGrid({ badges }: { badges: Badge[] }) {
  const { t, fmtNum } = useI18n();
  const earned = badges.filter((b) => b.earned).length;

  const label = (id: BadgeId): { name: string; how: string } => {
    if (isRankBadge(id)) {
      const level = RANKS.find((r) => r.id === id)?.firstLevel ?? 1;
      return {
        name: t(RANK_KEYS[id]),
        how: t('mono.rewards.rank.how', { n: fmtNum(level) }),
      };
    }
    const keys = BADGE_KEYS[id];
    return { name: t(keys.name), how: t(keys.how, { min: fmtNum(XP_RULES.projectMinItems) }) };
  };

  return (
    <div className="mono-badges" data-testid="badge-grid">
      <p className="mono-eyebrow mono-badges-head">
        <span>{t('mono.rewards.title')}</span>
        <span className="mono-rank-earned">
          {t('mono.rewards.count', { n: fmtNum(earned), total: fmtNum(badges.length) })}
        </span>
      </p>
      <ul className="mono-badges-grid">
        {badges.map((b) => {
          const { name, how } = label(b.id);
          return (
            <li
              key={b.id}
              className={b.earned ? 'mono-badge is-earned' : 'mono-badge'}
              data-badge={b.id}
              data-earned={b.earned ? 'true' : 'false'}
            >
              <span className="mono-badge-name">{name}</span>
              <span className="mono-badge-how">{b.earned ? t('mono.rewards.earned') : how}</span>
              {!b.earned && b.progress && (
                <span className="mono-badge-progress">
                  {t('mono.rewards.progress', {
                    n: fmtNum(b.progress.value),
                    target: isRankBadge(b.id)
                      ? t('mono.xp.xp', { n: fmtNum(b.progress.target) })
                      : fmtNum(b.progress.target),
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
