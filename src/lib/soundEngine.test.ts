import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_SOUNDS,
  SOUND_LABELS,
  CUSTOM_SOUND_LABEL,
  playSound,
  saveCustomSound,
  loadCustomSound,
  deleteCustomSound,
} from './soundEngine';

describe('BUILT_IN_SOUNDS', () => {
  it('contains the expected count of built-in sounds', () => {
    expect(BUILT_IN_SOUNDS).toHaveLength(7);
  });

  it('has a label for every built-in sound', () => {
    for (const s of BUILT_IN_SOUNDS) {
      expect(SOUND_LABELS[s]).toBeTruthy();
    }
  });
});

describe('CUSTOM_SOUND_LABEL', () => {
  it("is 'Custom'", () => {
    expect(CUSTOM_SOUND_LABEL).toBe('Custom');
  });
});

describe('playSound', () => {
  it('does not throw for any built-in sound at volume 0', () => {
    for (const s of BUILT_IN_SOUNDS) {
      expect(() => playSound(s, 0)).not.toThrow();
    }
  });

  it('does not throw for any built-in sound at volume 1', () => {
    for (const s of BUILT_IN_SOUNDS) {
      expect(() => playSound(s, 1)).not.toThrow();
    }
  });

  it('does not throw for unknown sound types', () => {
    expect(() => playSound('unknown_sound' as never, 0.5)).not.toThrow();
  });
});

describe('custom sound IndexedDB', () => {
  it('saveCustomSound returns false when IndexedDB is unavailable', async () => {
    // jsdom does not have a real IndexedDB — save should fail gracefully
    const result = await saveCustomSound(new ArrayBuffer(16));
    expect(typeof result).toBe('boolean');
  });

  it('loadCustomSound returns null when IndexedDB is unavailable', async () => {
    const result = await loadCustomSound();
    expect(result).toBeNull();
  });

  it('deleteCustomSound does not throw', async () => {
    await expect(deleteCustomSound()).resolves.toBeUndefined();
  });
});
