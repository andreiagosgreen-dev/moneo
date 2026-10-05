/* Move module: the workout player's beeps and spoken cues.
 *
 * Beeps are short oscillator tones on the shared AudioContext (no files to
 * load). Speech uses the browser's own voices; when the device has no voice
 * for the app language, nothing is spoken (beeps still play).
 */
import { getAudioContext } from '../soundEngine';
import type { CountdownCue } from './cues';

export type BeepKind = CountdownCue | 'done';

const TONES: Record<BeepKind, { freq: number; dur: number; gain: number }[]> = {
  tick: [{ freq: 880, dur: 0.12, gain: 0.25 }],
  go: [{ freq: 1320, dur: 0.45, gain: 0.3 }],
  done: [
    { freq: 784, dur: 0.18, gain: 0.25 },
    { freq: 988, dur: 0.18, gain: 0.25 },
    { freq: 1319, dur: 0.4, gain: 0.28 },
  ],
};

export function beep(kind: BeepKind): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    let at = ctx.currentTime + 0.01;
    for (const tone of TONES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = tone.freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(tone.gain, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + tone.dur + 0.02);
      at += tone.dur * 0.85;
    }
  } catch {
    /* audio unavailable */
  }
}

function synth(): SpeechSynthesis | null {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;
  } catch {
    return null;
  }
}

/** A device voice for a BCP 47 tag such as "ro-RO" (matched on the language). */
function voiceFor(tag: string): SpeechSynthesisVoice | undefined {
  const lang = tag.toLowerCase().split('-')[0];
  const voices = synth()?.getVoices() ?? [];
  return (
    voices.find((v) => v.lang.toLowerCase() === tag.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().split(/[-_]/)[0] === lang)
  );
}

/** Whether spoken cues can be offered in this language on this device. */
export function canSpeak(tag: string): boolean {
  return voiceFor(tag) !== undefined;
}

/** Calls back once the browser has loaded its voice list (some load it late). */
export function onVoicesReady(cb: () => void): () => void {
  const s = synth();
  if (!s) return () => {};
  if (s.getVoices().length > 0) cb();
  s.addEventListener?.('voiceschanged', cb);
  return () => s.removeEventListener?.('voiceschanged', cb);
}

export function speak(text: string, tag: string): void {
  const s = synth();
  const voice = voiceFor(tag);
  if (!s || !voice || !text) return;
  try {
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 1.05;
    s.speak(u);
  } catch {
    /* speech unavailable */
  }
}

export function stopSpeaking(): void {
  try {
    synth()?.cancel();
  } catch {
    /* speech unavailable */
  }
}
