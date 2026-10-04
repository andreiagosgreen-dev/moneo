/**
 * Rank rewards on the free plan: each rank unlocks some of the Pro
 * atmospheres and ambient sounds for good. Pro has everything already.
 * The rank comes from local XP (computed in the app); it is cached here so
 * screens outside the main app (Settings, Pricing, Login) paint the same.
 */
import type { AmbientId } from './ambient';
import type { ProAtmosphere } from '../mono/atmosphere';
import { safeRead, safeWrite } from './storage/storageAdapter';
import { STORAGE_KEYS } from './storage/storageKeys';
import { RANKS, type RankId } from './xpCore';

export interface RankUnlock {
  atmospheres: ProAtmosphere[];
  sounds: AmbientId[];
}

/** What each rank adds (not cumulative). */
export const RANK_UNLOCKS: Record<RankId, RankUnlock> = {
  beginner: { atmospheres: [], sounds: [] },
  apprentice: { atmospheres: ['azur', 'salvie'], sounds: ['pink'] },
  practitioner: { atmospheres: ['zare', 'crema', 'citron'], sounds: ['brown'] },
  expert: { atmospheres: ['liliac', 'cobalt', 'adanc', 'galerie'], sounds: [] },
  master: { atmospheres: ['lavanda', 'maslin', 'jar', 'bordo', 'livada'], sounds: [] },
};

const rankIndex = (id: RankId) => RANKS.findIndex((r) => r.id === id);

/** Everything unlocked up to and including `rank`. */
export function unlockedUpTo(rank: RankId): RankUnlock {
  const out: RankUnlock = { atmospheres: [], sounds: [] };
  for (const r of RANKS.slice(0, rankIndex(rank) + 1)) {
    out.atmospheres.push(...RANK_UNLOCKS[r.id].atmospheres);
    out.sounds.push(...RANK_UNLOCKS[r.id].sounds);
  }
  return out;
}

/** The next rank that unlocks something, with what it unlocks; null at the top. */
export function nextRankReward(rank: RankId): { id: RankId; unlock: RankUnlock } | null {
  for (const r of RANKS.slice(rankIndex(rank) + 1)) {
    const unlock = RANK_UNLOCKS[r.id];
    if (unlock.atmospheres.length || unlock.sounds.length) return { id: r.id, unlock };
  }
  return null;
}

const isRankId = (v: unknown): v is RankId =>
  typeof v === 'string' && RANKS.some((r) => r.id === v);

/** Last rank the app computed on this device ("beginner" when unknown). */
export function loadCachedRank(): RankId {
  const v = safeRead<unknown>(STORAGE_KEYS.rank);
  return isRankId(v) ? v : 'beginner';
}

export function saveCachedRank(rank: RankId): void {
  if (loadCachedRank() !== rank) safeWrite(STORAGE_KEYS.rank, rank);
}

/** A Pro atmosphere the free plan may use thanks to the rank. */
export function isAtmosphereUnlockedByRank(id: string, rank: RankId = loadCachedRank()): boolean {
  return (unlockedUpTo(rank).atmospheres as string[]).includes(id);
}

/** Ambient sounds the free plan gets on top of the free ones. */
export function soundsUnlockedByRank(rank: RankId = loadCachedRank()): AmbientId[] {
  return unlockedUpTo(rank).sounds;
}
