/**
 * Sound engine for Moneo — Web Audio API synthesis + custom audio file playback.
 *
 * Built-in sounds are synthesised (no external assets required).
 * Custom sounds are stored in IndexedDB and decoded at play time.
 */
import type { TKey } from './i18n/types';

export type BuiltInSound = 'bell' | 'gong' | 'piano' | 'birds' | 'gentle' | 'rain' | 'ocean';

export type SoundKind = BuiltInSound | 'custom';

export const BUILT_IN_SOUNDS: BuiltInSound[] = [
  'bell',
  'gong',
  'piano',
  'birds',
  'gentle',
  'rain',
  'ocean',
];

export const SOUND_LABELS: Record<BuiltInSound, TKey> = {
  bell: 'settings.sound.bell',
  gong: 'settings.sound.gong',
  piano: 'settings.sound.piano',
  birds: 'settings.sound.birds',
  gentle: 'settings.sound.gentle',
  rain: 'settings.sound.rain',
  ocean: 'settings.sound.ocean',
};

export const CUSTOM_SOUND_LABEL: TKey = 'settings.sound.custom';

/* ------------------------------------------------------------------ */
/*  AudioContext singleton                                             */
/* ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx || new Ctx();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Built-in synthesis                                                 */
/* ------------------------------------------------------------------ */

interface SynthNote {
  freq: number;
  start: number; // seconds from t0
  dur: number;
  wave: OscillatorType;
  gain: number; // 0-1 peak
  detune?: number;
}

function buildBellNotes(_t0: number): SynthNote[] {
  return [
    { freq: 659.25, start: 0, dur: 0.8, wave: 'sine', gain: 0.22 },
    { freq: 987.77, start: 0.12, dur: 0.7, wave: 'sine', gain: 0.16 },
    { freq: 1318.5, start: 0.24, dur: 0.5, wave: 'sine', gain: 0.09 },
  ];
}

function buildGongNotes(_t0: number): SynthNote[] {
  return [
    { freq: 196, start: 0, dur: 1.4, wave: 'triangle', gain: 0.25 },
    { freq: 293.66, start: 0.08, dur: 1.2, wave: 'triangle', gain: 0.18 },
    { freq: 392, start: 0.16, dur: 1.0, wave: 'sine', gain: 0.12 },
    { freq: 587.33, start: 0.3, dur: 0.6, wave: 'sine', gain: 0.07 },
  ];
}

function buildPianoNotes(_t0: number): SynthNote[] {
  // C major arpeggio with soft velocity
  return [
    { freq: 523.25, start: 0, dur: 0.7, wave: 'sine', gain: 0.18 },
    { freq: 659.25, start: 0.1, dur: 0.65, wave: 'sine', gain: 0.16 },
    { freq: 783.99, start: 0.2, dur: 0.6, wave: 'sine', gain: 0.14 },
    { freq: 1046.5, start: 0.3, dur: 0.5, wave: 'sine', gain: 0.1 },
  ];
}

function buildBirdsNotes(_t0: number): SynthNote[] {
  // Quick chirpy pattern
  return [
    { freq: 1200, start: 0, dur: 0.08, wave: 'sine', gain: 0.12 },
    { freq: 1600, start: 0.06, dur: 0.06, wave: 'sine', gain: 0.1 },
    { freq: 1400, start: 0.12, dur: 0.07, wave: 'sine', gain: 0.11 },
    { freq: 1800, start: 0.2, dur: 0.05, wave: 'sine', gain: 0.09 },
    { freq: 1300, start: 0.3, dur: 0.08, wave: 'sine', gain: 0.1 },
    { freq: 1700, start: 0.38, dur: 0.06, wave: 'sine', gain: 0.08 },
  ];
}

function buildGentleNotes(_t0: number): SynthNote[] {
  return [
    { freq: 440, start: 0, dur: 0.9, wave: 'sine', gain: 0.14 },
    { freq: 554.37, start: 0.15, dur: 0.8, wave: 'sine', gain: 0.12 },
    { freq: 659.25, start: 0.3, dur: 0.7, wave: 'sine', gain: 0.1 },
  ];
}

function playSynthNotes(notes: SynthNote[], vol: number) {
  const audio = getCtx();
  if (!audio) return;
  const t0 = audio.currentTime;

  for (const n of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = n.wave;
    osc.frequency.value = n.freq;
    if (n.detune) osc.detune.value = n.detune;

    const start = t0 + n.start;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(n.gain * vol, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);

    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.05);
  }
}

/* ------------------------------------------------------------------ */
/*  Noise-based ambient sounds (rain, ocean)                           */
/* ------------------------------------------------------------------ */

function createNoiseBuffer(audio: AudioContext, seconds: number): AudioBuffer {
  const sr = audio.sampleRate;
  const len = sr * seconds;
  const buf = audio.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playRain(vol: number) {
  const audio = getCtx();
  if (!audio) return;
  const t0 = audio.currentTime;

  // White noise through bandpass for rain character
  const noise = audio.createBufferSource();
  noise.buffer = createNoiseBuffer(audio, 2);

  const bandpass = audio.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 3000;
  bandpass.Q.value = 0.5;

  const highpass = audio.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 800;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.22 * vol, t0 + 0.15);
  gain.gain.setValueAtTime(0.22 * vol, t0 + 0.8);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);

  noise.connect(bandpass).connect(highpass).connect(gain).connect(audio.destination);
  noise.start(t0);
  noise.stop(t0 + 1.8);

  // Add a few "drip" tones for texture
  const drips = [
    { freq: 2400, start: 0.1, dur: 0.04 },
    { freq: 3200, start: 0.35, dur: 0.03 },
    { freq: 2800, start: 0.6, dur: 0.04 },
    { freq: 3600, start: 0.9, dur: 0.03 },
  ];
  for (const d of drips) {
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = d.freq;
    const s = t0 + d.start;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.06 * vol, s + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, s + d.dur);
    osc.connect(g).connect(audio.destination);
    osc.start(s);
    osc.stop(s + d.dur + 0.02);
  }
}

function playOcean(vol: number) {
  const audio = getCtx();
  if (!audio) return;
  const t0 = audio.currentTime;

  // Low rumble through lowpass for wave character
  const noise = audio.createBufferSource();
  noise.buffer = createNoiseBuffer(audio, 2.5);

  const lowpass = audio.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 400;
  lowpass.Q.value = 1.2;

  // LFO to simulate wave swell
  const lfo = audio.createOscillator();
  const lfoGain = audio.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.4;
  lfoGain.gain.value = 200;
  lfo.connect(lfoGain).connect(lowpass.frequency);

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.2 * vol, t0 + 0.5);
  gain.gain.setValueAtTime(0.2 * vol, t0 + 1.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);

  noise.connect(lowpass).connect(gain).connect(audio.destination);
  lfo.start(t0);
  noise.start(t0);
  noise.stop(t0 + 2.5);
  lfo.stop(t0 + 2.5);

  // High "foam" shimmer
  const foam = audio.createBufferSource();
  foam.buffer = createNoiseBuffer(audio, 2);
  const foamBp = audio.createBiquadFilter();
  foamBp.type = 'bandpass';
  foamBp.frequency.value = 5000;
  foamBp.Q.value = 0.8;
  const foamGain = audio.createGain();
  foamGain.gain.setValueAtTime(0.0001, t0);
  foamGain.gain.exponentialRampToValueAtTime(0.05 * vol, t0 + 0.3);
  foamGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
  foam.connect(foamBp).connect(foamGain).connect(audio.destination);
  foam.start(t0 + 0.2);
  foam.stop(t0 + 2);
}

/* ------------------------------------------------------------------ */
/*  Custom sound playback (from IndexedDB)                             */
/* ------------------------------------------------------------------ */

const CUSTOM_DB_NAME = 'moneo-custom-sounds';
const CUSTOM_STORE_NAME = 'sounds';
const CUSTOM_SOUND_KEY = 'uploaded';

function openCustomDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(CUSTOM_DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(CUSTOM_STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveCustomSound(data: ArrayBuffer): Promise<boolean> {
  const db = await openCustomDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CUSTOM_STORE_NAME, 'readwrite');
      tx.objectStore(CUSTOM_STORE_NAME).put(data, CUSTOM_SOUND_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function loadCustomSound(): Promise<ArrayBuffer | null> {
  const db = await openCustomDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CUSTOM_STORE_NAME, 'readonly');
      const req = tx.objectStore(CUSTOM_STORE_NAME).get(CUSTOM_SOUND_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteCustomSound(): Promise<void> {
  const db = await openCustomDB();
  if (!db) return;
  try {
    const tx = db.transaction(CUSTOM_STORE_NAME, 'readwrite');
    tx.objectStore(CUSTOM_STORE_NAME).delete(CUSTOM_SOUND_KEY);
  } catch {
    /* ignore */
  }
}

async function playCustomSound(vol: number) {
  const audio = getCtx();
  if (!audio) return;
  const buf = await loadCustomSound();
  if (!buf) return;

  try {
    const decoded = await audio.decodeAudioData(buf);
    const source = audio.createBufferSource();
    source.buffer = decoded;
    const gain = audio.createGain();
    gain.gain.value = vol;
    source.connect(gain).connect(audio.destination);
    source.start();
  } catch {
    /* corrupt audio — stay silent */
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function playSound(soundType: BuiltInSound | string, vol: number, customBuf?: ArrayBuffer) {
  const v = Math.min(1, Math.max(0, vol));

  if (soundType === 'custom' && customBuf) {
    // Play from provided buffer (avoids async IndexedDB read for preview)
    void playCustomSoundFromBuffer(customBuf, v);
    return;
  }

  if (soundType === 'custom') {
    void playCustomSound(v);
    return;
  }

  switch (soundType) {
    case 'bell':
      playSynthNotes(buildBellNotes(0), v);
      break;
    case 'gong':
      playSynthNotes(buildGongNotes(0), v);
      break;
    case 'piano':
      playSynthNotes(buildPianoNotes(0), v);
      break;
    case 'birds':
      playSynthNotes(buildBirdsNotes(0), v);
      break;
    case 'gentle':
      playSynthNotes(buildGentleNotes(0), v);
      break;
    case 'rain':
      playRain(v);
      break;
    case 'ocean':
      playOcean(v);
      break;
    default:
      playSynthNotes(buildBellNotes(0), v);
  }
}

async function playCustomSoundFromBuffer(buf: ArrayBuffer, vol: number) {
  const audio = getCtx();
  if (!audio) return;
  try {
    const decoded = await audio.decodeAudioData(buf);
    const source = audio.createBufferSource();
    source.buffer = decoded;
    const gain = audio.createGain();
    gain.gain.value = vol;
    source.connect(gain).connect(audio.destination);
    source.start();
  } catch {
    /* corrupt */
  }
}
