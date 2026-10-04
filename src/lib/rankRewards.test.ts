import { beforeEach, describe, expect, it } from 'vitest';
import { ATMOSPHERES, isProAtmosphere, resolveAtmosphere } from '../mono/atmosphere';
import { FREE_AMBIENT, sanitizeLayers } from './ambient';
import {
  RANK_UNLOCKS,
  isAtmosphereUnlockedByRank,
  loadCachedRank,
  nextRankReward,
  saveCachedRank,
  soundsUnlockedByRank,
  unlockedUpTo,
} from './rankRewards';
import { RANKS } from './xpCore';

beforeEach(() => localStorage.clear());

describe('rank rewards', () => {
  it('unlocks only Pro atmospheres and non-free sounds, each once', () => {
    const all = RANKS.flatMap((r) => RANK_UNLOCKS[r.id].atmospheres);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(isProAtmosphere(id)).toBe(true);
    for (const r of RANKS) {
      for (const s of RANK_UNLOCKS[r.id].sounds) expect(FREE_AMBIENT).not.toContain(s);
    }
  });

  it('keeps some atmospheres Pro-only even at the top rank', () => {
    const owned: string[] = unlockedUpTo('master').atmospheres;
    expect(owned.length).toBe(14);
    expect(ATMOSPHERES.filter(isProAtmosphere).some((id) => !owned.includes(id))).toBe(true);
  });

  it('accumulates rewards up to the rank', () => {
    expect(unlockedUpTo('beginner')).toEqual({ atmospheres: [], sounds: [] });
    expect(unlockedUpTo('practitioner').atmospheres).toEqual([
      'azur',
      'salvie',
      'zare',
      'crema',
      'citron',
    ]);
    expect(unlockedUpTo('practitioner').sounds).toEqual(['pink', 'brown']);
  });

  it('names the next rank that unlocks something', () => {
    expect(nextRankReward('beginner')?.id).toBe('apprentice');
    expect(nextRankReward('expert')?.id).toBe('master');
    expect(nextRankReward('master')).toBeNull();
  });

  it('caches the rank and falls back to beginner', () => {
    expect(loadCachedRank()).toBe('beginner');
    saveCachedRank('expert');
    expect(loadCachedRank()).toBe('expert');
    localStorage.setItem('moneo:rank', JSON.stringify('wizard'));
    expect(loadCachedRank()).toBe('beginner');
  });

  it('lets the free plan paint an atmosphere its rank unlocked', () => {
    expect(isAtmosphereUnlockedByRank('azur', 'beginner')).toBe(false);
    expect(isAtmosphereUnlockedByRank('azur', 'apprentice')).toBe(true);
    expect(resolveAtmosphere('azur', false, 'apprentice')).toBe('azur');
    expect(resolveAtmosphere('livada', false, 'apprentice')).not.toBe('livada');
    expect(resolveAtmosphere('livada', true, 'beginner')).toBe('livada');
  });

  it('keeps rank sounds in a free mix', () => {
    saveCachedRank('practitioner');
    expect(soundsUnlockedByRank()).toEqual(['pink', 'brown']);
    const layers = sanitizeLayers([{ id: 'brown', volume: 0.5 }], false, soundsUnlockedByRank());
    expect(layers.map((l) => l.id)).toContain('brown');
  });
});
