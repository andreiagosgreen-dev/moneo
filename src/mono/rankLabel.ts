import type { TKey } from '../lib/i18n/types';
import { type RankId, rankForLevel, romanNumeral } from '../lib/xp';

export const RANK_KEYS: Record<RankId, TKey> = {
  beginner: 'mono.xp.rank.beginner',
  apprentice: 'mono.xp.rank.apprentice',
  practitioner: 'mono.xp.rank.practitioner',
  expert: 'mono.xp.rank.expert',
  master: 'mono.xp.rank.master',
};

/** "Apprentice II" — localized rank name plus the step inside it. */
export function rankLabel(t: (key: TKey) => string, level: number): string {
  const rank = rankForLevel(level);
  return `${t(RANK_KEYS[rank.id])} ${romanNumeral(rank.tier)}`;
}
