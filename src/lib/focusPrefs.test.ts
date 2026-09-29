import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FOCUS_PREFS, loadFocusPrefs, saveFocusPrefs } from './focusPrefs';
import { STORAGE_KEYS } from './storage/storageKeys';

describe('focusPrefs', () => {
  beforeEach(() => localStorage.clear());

  it('defaults when nothing is stored or data is junk', () => {
    expect(loadFocusPrefs()).toEqual(DEFAULT_FOCUS_PREFS);
    localStorage.setItem(STORAGE_KEYS.focusPrefs, '"nope"');
    expect(loadFocusPrefs()).toEqual(DEFAULT_FOCUS_PREFS);
  });

  it('round-trips and sanitises layers', () => {
    saveFocusPrefs({
      ambient: [
        { id: 'ocean', volume: 0.4 },
        { id: 'ocean', volume: 0.9 },
      ],
      ambientOn: true,
      wakeLock: false,
    });
    expect(loadFocusPrefs()).toEqual({
      ambient: [{ id: 'ocean', volume: 0.4 }],
      ambientOn: true,
      wakeLock: false,
    });
  });
});
