import type { TKey } from '../lib/i18n/types';
import type { BadgeId } from '../lib/badges';
import { RANK_KEYS } from './rankLabel';

export const RANK_BADGES = ['apprentice', 'practitioner', 'expert'] as const;
export type RankBadgeId = (typeof RANK_BADGES)[number];

export const BADGE_KEYS: Record<Exclude<BadgeId, RankBadgeId>, { name: TKey; how: TKey }> = {
  firstFocus: { name: 'mono.rewards.firstFocus.name', how: 'mono.rewards.firstFocus.how' },
  focus10h: { name: 'mono.rewards.focus10h.name', how: 'mono.rewards.focus10h.how' },
  streak7: { name: 'mono.rewards.streak7.name', how: 'mono.rewards.streak7.how' },
  firstProject: { name: 'mono.rewards.firstProject.name', how: 'mono.rewards.firstProject.how' },
  tasks50: { name: 'mono.rewards.tasks50.name', how: 'mono.rewards.tasks50.how' },
};

export function isRankBadge(id: BadgeId): id is RankBadgeId {
  return (RANK_BADGES as readonly BadgeId[]).includes(id);
}

/** Display-name key of a badge; rank badges reuse their rank label. */
export function badgeNameKey(id: BadgeId): TKey {
  return isRankBadge(id) ? RANK_KEYS[id] : BADGE_KEYS[id].name;
}
