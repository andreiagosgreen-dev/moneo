import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../lib/storage/storageKeys';
import {
  ATMOSPHERES,
  DEFAULT_ATMOSPHERE,
  FREE_ATMOSPHERES,
  PRO_ATMOSPHERES,
  applyAtmosphere,
  isAtmosphere,
  isProAtmosphere,
  loadAtmosphere,
  resolveAtmosphere,
  saveAtmosphere,
} from './atmosphere';

beforeEach(() => {
  localStorage.clear();
});

describe('atmosphere', () => {
  it('keeps classic themes free and lists Pro interior packs separately', () => {
    expect(FREE_ATMOSPHERES).toHaveLength(20);
    expect(PRO_ATMOSPHERES).toHaveLength(22);
    expect(ATMOSPHERES).toHaveLength(42);
    expect(ATMOSPHERES).toEqual([...FREE_ATMOSPHERES, ...PRO_ATMOSPHERES]);
    for (const id of FREE_ATMOSPHERES) {
      expect(isProAtmosphere(id)).toBe(false);
    }
    for (const id of PRO_ATMOSPHERES) {
      expect(isProAtmosphere(id)).toBe(true);
    }
  });

  it('resolves Pro packs to the default for Free users', () => {
    expect(resolveAtmosphere('ritual', false)).toBe('ritual');
    expect(resolveAtmosphere('azur', true)).toBe('azur');
    expect(resolveAtmosphere('azur', false)).toBe(DEFAULT_ATMOSPHERE);
    expect(resolveAtmosphere('merlot', false)).toBe('ritual');
  });

  it('defaults to ritual when nothing is stored', () => {
    expect(loadAtmosphere()).toBe('ritual');
    expect(DEFAULT_ATMOSPHERE).toBe('ritual');
  });

  it('round-trips a chosen atmosphere', () => {
    expect(saveAtmosphere('ritual')).toBe(true);
    expect(loadAtmosphere()).toBe('ritual');
    expect(localStorage.getItem(STORAGE_KEYS.atmosphere)).toBe('"ritual"');
    expect(saveAtmosphere('merlot')).toBe(true);
    expect(loadAtmosphere()).toBe('merlot');
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem(STORAGE_KEYS.atmosphere, '"neon"');
    expect(loadAtmosphere()).toBe('ritual');
    expect(isAtmosphere('clar')).toBe(true);
    expect(isAtmosphere('azur')).toBe(true);
    expect(isAtmosphere('neon')).toBe(false);
  });

  it('applies atmosphere onto the document element for global colors', () => {
    applyAtmosphere('capitol');
    expect(document.documentElement.dataset.atmosphere).toBe('capitol');
    applyAtmosphere('clar');
    expect(document.documentElement.dataset.atmosphere).toBe('clar');
    applyAtmosphere('fildes');
    expect(document.documentElement.dataset.atmosphere).toBe('fildes');
  });
});
