import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../lib/storage/storageKeys';
import {
  ATMOSPHERES,
  DEFAULT_ATMOSPHERE,
  applyAtmosphere,
  isAtmosphere,
  loadAtmosphere,
  saveAtmosphere,
} from './atmosphere';

beforeEach(() => {
  localStorage.clear();
});

describe('atmosphere', () => {
  it('offers twenty themes and defaults the choice through the picker', () => {
    expect(ATMOSPHERES).toHaveLength(20);
  });

  it('defaults to ritual when nothing is stored', () => {
    expect(loadAtmosphere()).toBe('ritual');
    expect(DEFAULT_ATMOSPHERE).toBe('ritual');
  });

  it('round-trips a chosen atmosphere', () => {
    expect(saveAtmosphere('ritual')).toBe(true);
    expect(loadAtmosphere()).toBe('ritual');
    expect(localStorage.getItem(STORAGE_KEYS.atmosphere)).toBe('"ritual"');
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem(STORAGE_KEYS.atmosphere, '"neon"');
    expect(loadAtmosphere()).toBe('ritual');
    expect(isAtmosphere('clar')).toBe(true);
    expect(isAtmosphere('neon')).toBe(false);
  });

  it('applies atmosphere onto the document element for global colors', () => {
    applyAtmosphere('capitol');
    expect(document.documentElement.dataset.atmosphere).toBe('capitol');
    applyAtmosphere('clar');
    expect(document.documentElement.dataset.atmosphere).toBe('clar');
  });
});
