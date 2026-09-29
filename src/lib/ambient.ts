/* Looping ambient sound for focus sessions — synthesised, no audio files. */

export type AmbientId = 'rain' | 'ocean' | 'white' | 'pink' | 'brown';
export const AMBIENT_IDS: AmbientId[] = ['rain', 'ocean', 'white', 'pink', 'brown'];
export const FREE_AMBIENT: AmbientId[] = ['rain', 'ocean', 'white'];
export const MAX_LAYERS = 3;

export interface AmbientLayer {
  id: AmbientId;
  /** 0..1 */
  volume: number;
}

/** Small seeded PRNG so generated loops are deterministic. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fillWhite(out: Float32Array, rnd: () => number): void {
  for (let i = 0; i < out.length; i++) out[i] = rnd() * 2 - 1;
}

/** Paul Kellet's economy pink filter. */
export function fillPink(out: Float32Array, rnd: () => number): void {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  normalize(out, 0.9);
}

/** Leaky integrator over white noise, normalised to a peak of 0.9. */
export function fillBrown(out: Float32Array, rnd: () => number): void {
  let last = 0;
  for (let i = 0; i < out.length; i++) {
    const w = rnd() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    out[i] = last;
  }
  normalize(out, 0.9);
}

function normalize(out: Float32Array, peak: number): void {
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  if (max === 0) return;
  const k = peak / max;
  for (let i = 0; i < out.length; i++) out[i] *= k;
}

/** Sea and blue atmospheres (shore, sea, azure, cobalt, deep, turquoise, horizon). */
const OCEANIC = new Set(['tarm', 'mare', 'azur', 'cobalt', 'adanc', 'turcoaz', 'zare']);

/** The atmosphere's default sound: water-ish skins get the ocean, everything else rain. */
export function defaultAmbientFor(atmosphere: string, isPro: boolean): AmbientId {
  const id: AmbientId = OCEANIC.has(atmosphere) ? 'ocean' : 'rain';
  return isPro || FREE_AMBIENT.includes(id) ? id : 'rain';
}

/** Valid layers for the plan: Free → one free sound; Pro → up to 3 distinct sounds. */
export function sanitizeLayers(layers: unknown, isPro: boolean): AmbientLayer[] {
  if (!Array.isArray(layers)) return [];
  const seen = new Set<AmbientId>();
  const out: AmbientLayer[] = [];
  for (const raw of layers) {
    if (!raw || typeof raw !== 'object') continue;
    const { id, volume } = raw as { id?: unknown; volume?: unknown };
    if (typeof id !== 'string' || !AMBIENT_IDS.includes(id as AmbientId)) continue;
    if (seen.has(id as AmbientId)) continue;
    if (!isPro && !FREE_AMBIENT.includes(id as AmbientId)) continue;
    const v = typeof volume === 'number' && Number.isFinite(volume) ? volume : 0.6;
    seen.add(id as AmbientId);
    out.push({ id: id as AmbientId, volume: Math.min(1, Math.max(0, v)) });
    if (out.length >= (isPro ? MAX_LAYERS : 1)) break;
  }
  return out;
}

/** True when nothing would be audible. */
export function isSilent(layers: AmbientLayer[]): boolean {
  return layers.every((l) => l.volume <= 0);
}

export interface AmbientHandle {
  setLayers(layers: AmbientLayer[]): void;
  stop(fadeMs?: number): Promise<void>;
}

const LOOP_SECONDS = 4;
const FADE_S = 1.5;
const SEEDS: Record<AmbientId, number> = { rain: 11, ocean: 23, white: 37, pink: 41, brown: 53 };

function makeBuffer(ctx: AudioContext, id: AmbientId): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * LOOP_SECONDS);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rnd = mulberry32(SEEDS[id]);
  if (id === 'white') fillWhite(data, rnd);
  else if (id === 'rain' || id === 'pink') fillPink(data, rnd);
  else fillBrown(data, rnd);
  return buf;
}

interface Voice {
  id: AmbientId;
  gain: GainNode;
  nodes: AudioScheduledSourceNode[];
}

function makeVoice(ctx: AudioContext, id: AmbientId, out: AudioNode): Voice {
  const src = ctx.createBufferSource();
  src.buffer = makeBuffer(ctx, id);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  const swell = ctx.createGain();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const nodes: AudioScheduledSourceNode[] = [src];
  if (id === 'rain' || id === 'ocean') {
    filter.type = id === 'rain' ? 'highpass' : 'lowpass';
    filter.frequency.value = id === 'rain' ? 400 : 500;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = id === 'rain' ? 0.15 : 0.08;
    depth.gain.value = id === 'rain' ? 0.15 : 0.35;
    swell.gain.value = 1 - depth.gain.value;
    lfo.connect(depth).connect(swell.gain);
    nodes.push(lfo);
  } else {
    filter.type = 'lowpass';
    filter.frequency.value = 8000;
  }
  src.connect(filter).connect(swell).connect(gain).connect(out);
  for (const n of nodes) n.start();
  return { id, gain, nodes };
}

/** Start looping layers on `ctx`; fades in over 1.5 s. */
export function startAmbient(ctx: AudioContext, layers: AmbientLayer[]): AmbientHandle {
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  let voices: Voice[] = [];

  const setLayers = (next: AmbientLayer[]) => {
    const now = ctx.currentTime;
    for (const v of voices) {
      if (!next.some((l) => l.id === v.id)) {
        v.gain.gain.setTargetAtTime(0, now, FADE_S / 3);
        const nodes = v.nodes;
        window.setTimeout(() => nodes.forEach((n) => safeStop(n)), FADE_S * 1000 + 200);
      }
    }
    voices = voices.filter((v) => next.some((l) => l.id === v.id));
    for (const l of next) {
      let v = voices.find((x) => x.id === l.id);
      if (!v) {
        v = makeVoice(ctx, l.id, master);
        voices.push(v);
      }
      v.gain.gain.setTargetAtTime(l.volume, now, FADE_S / 3);
    }
  };

  setLayers(layers);

  return {
    setLayers,
    stop(fadeMs = FADE_S * 1000) {
      master.gain.setTargetAtTime(0, ctx.currentTime, fadeMs / 3000);
      const all = voices;
      voices = [];
      return new Promise((resolve) => {
        window.setTimeout(() => {
          all.forEach((v) => v.nodes.forEach((n) => safeStop(n)));
          master.disconnect();
          resolve();
        }, fadeMs + 100);
      });
    },
  };
}

function safeStop(n: AudioScheduledSourceNode): void {
  try {
    n.stop();
  } catch {
    /* already stopped */
  }
}
