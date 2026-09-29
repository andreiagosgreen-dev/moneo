import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import type { Badge, BadgeId } from '../lib/badges';
import { RANKS, XP_RULES } from '../lib/xp';
import { RANK_KEYS } from './rankLabel';

const RANK_BADGES = ['apprentice', 'practitioner', 'expert'] as const;
type RankBadgeId = (typeof RANK_BADGES)[number];

const BADGE_KEYS: Record<Exclude<BadgeId, RankBadgeId>, { name: TKey; how: TKey }> = {
  firstFocus: { name: 'mono.rewards.firstFocus.name', how: 'mono.rewards.firstFocus.how' },
  focus10h: { name: 'mono.rewards.focus10h.name', how: 'mono.rewards.focus10h.how' },
  streak7: { name: 'mono.rewards.streak7.name', how: 'mono.rewards.streak7.how' },
  firstProject: { name: 'mono.rewards.firstProject.name', how: 'mono.rewards.firstProject.how' },
  tasks50: { name: 'mono.rewards.tasks50.name', how: 'mono.rewards.tasks50.how' },
};

function isRankBadge(id: BadgeId): id is RankBadgeId {
  return (RANK_BADGES as readonly BadgeId[]).includes(id);
}

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
