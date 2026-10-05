/* Move module: when the workout player beeps or speaks (pure, no audio).
 *
 * The player ticks `now` every 250 ms; comparing the time left before and
 * after a tick tells whether a whole second was crossed. Beeps mark the last
 * three seconds of a rest or a timed hold, and a longer tone marks zero.
 */
import { safeRead, safeWrite } from '../storage/storageAdapter';
import { STORAGE_KEYS } from '../storage/storageKeys';

export type CountdownCue = 'tick' | 'go';

/** Seconds that get a short beep before zero. */
export const COUNTDOWN_SECONDS = 3;
/** Lead-in before a timed hold the user starts by hand. */
export const LEAD_IN_MS = COUNTDOWN_SECONDS * 1000;

/**
 * The cue for a countdown going from `prevMs` to `nextMs` left: a tick when it
 * enters one of the last three seconds, "go" when it reaches zero.
 */
export function countdownCue(prevMs: number, nextMs: number): CountdownCue | null {
  if (prevMs <= 0 || nextMs >= prevMs) return null;
  if (nextMs <= 0) return 'go';
  const before = Math.ceil(prevMs / 1000);
  const after = Math.ceil(nextMs / 1000);
  return after < before && after <= COUNTDOWN_SECONDS ? 'tick' : null;
}

export interface WorkoutSoundPrefs {
  /** Countdown beeps and the end-of-timer tone. */
  beeps: boolean;
  /** Spoken cues (next exercise, switch sides, done) when the device has a voice. */
  voice: boolean;
  /** A timed hold starts by itself when the rest before it runs out. */
  autoStart: boolean;
}

export const DEFAULT_SOUND_PREFS: WorkoutSoundPrefs = { beeps: true, voice: true, autoStart: true };

export function loadSoundPrefs(): WorkoutSoundPrefs {
  const v = safeRead<Partial<WorkoutSoundPrefs> | null>(STORAGE_KEYS.workoutSound);
  if (!v || typeof v !== 'object') return { ...DEFAULT_SOUND_PREFS };
  const pick = (k: keyof WorkoutSoundPrefs) =>
    typeof v[k] === 'boolean' ? (v[k] as boolean) : DEFAULT_SOUND_PREFS[k];
  return { beeps: pick('beeps'), voice: pick('voice'), autoStart: pick('autoStart') };
}

export function saveSoundPrefs(prefs: WorkoutSoundPrefs): void {
  safeWrite(STORAGE_KEYS.workoutSound, prefs);
}
