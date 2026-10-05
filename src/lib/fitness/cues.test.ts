import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SOUND_PREFS, countdownCue, loadSoundPrefs, saveSoundPrefs } from './cues';

beforeEach(() => localStorage.clear());

describe('countdownCue', () => {
  it('ticks once on entering each of the last three seconds', () => {
    const ticks: (string | null)[] = [];
    for (let ms = 5000; ms > 0; ms -= 250) ticks.push(countdownCue(ms, ms - 250));
    expect(ticks.filter((c) => c === 'tick')).toHaveLength(3);
    expect(ticks[ticks.length - 1]).toBe('go');
  });

  it('marks zero with "go" even after a long frame', () => {
    expect(countdownCue(1800, 0)).toBe('go');
  });

  it('stays quiet outside the last seconds, when paused and when time goes up', () => {
    expect(countdownCue(10_000, 9_750)).toBeNull();
    expect(countdownCue(2_000, 2_000)).toBeNull();
    expect(countdownCue(2_000, 30_000)).toBeNull();
    expect(countdownCue(0, 0)).toBeNull();
  });

  it('ticks at 3, 2 and 1 seconds left', () => {
    expect(countdownCue(3_100, 2_900)).toBe('tick');
    expect(countdownCue(2_100, 1_900)).toBe('tick');
    expect(countdownCue(1_100, 900)).toBe('tick');
    expect(countdownCue(4_100, 3_900)).toBeNull();
  });
});

describe('sound prefs', () => {
  it('defaults to beeps, voice and auto-start on', () => {
    expect(loadSoundPrefs()).toEqual(DEFAULT_SOUND_PREFS);
  });

  it('round-trips and ignores junk', () => {
    saveSoundPrefs({ beeps: false, voice: true, autoStart: false });
    expect(loadSoundPrefs()).toEqual({ beeps: false, voice: true, autoStart: false });
    localStorage.setItem('moneo:workout-sound', JSON.stringify({ beeps: 'yes', voice: false }));
    expect(loadSoundPrefs()).toEqual({ beeps: true, voice: false, autoStart: true });
  });
});
