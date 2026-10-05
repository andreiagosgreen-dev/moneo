/* Move module: workout packs built on the spot (free).
 *
 * The user picks a zone, a length, a format and a level; the pack is built
 * on the device from the exercise library and the user's own equipment:
 * warm-up → main block → cool-down, with every work and rest time set.
 * Seeded, so "another one" reshuffles and the same seed gives the same pack.
 */
import {
  EXERCISES,
  getExercise,
  type Equipment,
  type Exercise,
  type FitLevel,
  type FitPlace,
  type Muscle,
  type RoutineStep,
} from './library';

export type PackZone =
  'full' | 'core' | 'upper' | 'lower' | 'glutes' | 'back' | 'cardio' | 'mobility';
export const PACK_ZONES: readonly PackZone[] = [
  'full',
  'core',
  'upper',
  'lower',
  'glutes',
  'back',
  'cardio',
  'mobility',
];

/** circuit: timed stations, hands-free · sets: classic sets × reps · tabata: 20 s on / 10 s off. */
export type PackFormat = 'circuit' | 'sets' | 'tabata';
export const PACK_FORMATS: readonly PackFormat[] = ['circuit', 'sets', 'tabata'];

export const PACK_MINUTES = [10, 15, 20, 30, 45, 60] as const;

/** Equipment a home user can own (the gym has everything). */
export const HOME_GEAR: readonly Equipment[] = [
  'dumbbell',
  'kettlebell',
  'band',
  'miniBand',
  'rope',
  'pullupBar',
  'pushupBars',
  'dipBars',
  'abWheel',
  'abBench',
  'bench',
  'fitball',
  'medBall',
  'foamRoller',
  'step',
  'ankleWeights',
  'suspension',
];

/** Gear that comes in weights the user can list. */
export const WEIGHTED_GEAR: readonly Equipment[] = [
  'dumbbell',
  'kettlebell',
  'medBall',
  'ankleWeights',
];

/** Weights offered in "My weights" (kg). */
export const WEIGHT_STEPS = [
  0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10, 12, 12.5, 15, 16, 17.5, 20, 22.5, 24, 25, 27.5, 30,
  32.5, 35,
] as const;

export interface PackChoice {
  zone: PackZone;
  minutes: number;
  format: PackFormat;
  level: FitLevel;
}

export const DEFAULT_PACK_CHOICE: PackChoice = {
  zone: 'full',
  minutes: 20,
  format: 'circuit',
  level: 1,
};

/** "My equipment": what the user owns, their weights, and the last pack choice. */
export interface GearProfile {
  items: Equipment[];
  /** kg, ascending. */
  weights: number[];
  last?: PackChoice;
}

const isLevel = (v: unknown): v is FitLevel => v === 1 || v === 2 || v === 3;

export function cleanChoice(v: unknown): PackChoice | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const c = v as Record<string, unknown>;
  if (!PACK_ZONES.includes(c.zone as PackZone)) return undefined;
  if (!PACK_FORMATS.includes(c.format as PackFormat)) return undefined;
  if (!(PACK_MINUTES as readonly number[]).includes(c.minutes as number)) return undefined;
  if (!isLevel(c.level)) return undefined;
  return {
    zone: c.zone as PackZone,
    format: c.format as PackFormat,
    minutes: c.minutes as number,
    level: c.level,
  };
}

export function cleanGear(v: unknown): GearProfile | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const g = v as Record<string, unknown>;
  const items = Array.isArray(g.items)
    ? [...new Set(g.items.filter((e): e is Equipment => HOME_GEAR.includes(e as Equipment)))]
    : [];
  const weights = Array.isArray(g.weights)
    ? [
        ...new Set(
          g.weights.filter(
            (w): w is number => typeof w === 'number' && Number.isFinite(w) && w > 0 && w <= 200,
          ),
        ),
      ].sort((a, b) => a - b)
    : [];
  const last = cleanChoice(g.last);
  return { items, weights, ...(last ? { last } : {}) };
}

/** Weights to offer as one-tap picks for an exercise, when its gear is weighted. */
export function weightPicks(gear: GearProfile | undefined, exId: string): number[] {
  const ex = getExercise(exId);
  if (!gear || !ex || !WEIGHTED_GEAR.includes(ex.equipment)) return [];
  return gear.weights;
}

/* ---------- building a pack ---------- */

export const isPackId = (id: string) => id.startsWith('pack-');
export const packId = (c: PackChoice) => `pack-${c.zone}-${c.minutes}-${c.format}`;
/** Zone of a pack id, for its title. */
export function packZoneOf(id: string): PackZone | undefined {
  const z = id.split('-')[1] as PackZone;
  return isPackId(id) && PACK_ZONES.includes(z) ? z : undefined;
}

export interface Pack {
  id: string;
  choice: PackChoice;
  seed: number;
  steps: RoutineStep[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  /** Rounds of the main block (circuit / tabata) or sets per exercise (sets). */
  rounds: number;
  workSec: number;
  restSec: number;
  minutes: number;
}

type Slot = readonly Muscle[];
const ANY_CARDIO: Slot = [];

/** Main muscles each station may target, cycled to fill the block. */
const ZONE_SLOTS: Record<Exclude<PackZone, 'cardio' | 'mobility'>, readonly Slot[]> = {
  full: [
    ['quads', 'glutes'],
    ['chest', 'shoulders', 'triceps'],
    ANY_CARDIO,
    ['abs', 'obliques'],
    ['lats', 'traps', 'biceps', 'lowerBack'],
    ['glutes', 'hamstrings'],
    ['shoulders', 'chest'],
  ],
  core: [['abs'], ['obliques'], ['abs'], ['lowerBack'], ['abs'], ['obliques'], ['abs']],
  upper: [['chest'], ['lats'], ['shoulders'], ['biceps'], ['triceps'], ['traps'], ['chest']],
  lower: [['quads'], ['glutes'], ['hamstrings'], ['quads'], ['adductors'], ['calves'], ['glutes']],
  glutes: [['glutes'], ['hamstrings'], ['glutes'], ['adductors'], ['glutes'], ['hamstrings']],
  back: [['lats'], ['traps'], ['lowerBack'], ['lats'], ['biceps'], ['traps']],
};

const WARMUP = ['jack', 'armCircles', 'highKnees', 'worldsGreatest', 'inchworm', 'catCow'];
const COOLDOWN: Record<PackZone, string[]> = {
  full: ['hamstring', 'chestOpener', 'child', 'quadStretch'],
  core: ['cobra', 'child', 'reclinedTwist', 'catCow'],
  upper: ['chestOpener', 'tricepsStretch', 'shoulderCross', 'child'],
  lower: ['quadStretch', 'hamstring', 'figureFour', 'calfStretch'],
  glutes: ['figureFour', 'pigeon', 'hamstring', 'butterfly'],
  back: ['child', 'catCow', 'reclinedTwist', 'seatedTwist'],
  cardio: ['quadStretch', 'calfStretch', 'hamstring', 'child'],
  mobility: [],
};

/** Work / rest seconds per station by level (circuit). */
const CIRCUIT: Record<FitLevel, [number, number]> = { 1: [30, 30], 2: [40, 20], 3: [45, 15] };
const STATIONS: Record<number, number> = { 10: 4, 15: 5, 20: 5, 30: 6, 45: 6, 60: 7 };
const SETS_EX: Record<number, number> = { 10: 3, 15: 3, 20: 4, 30: 5, 45: 7, 60: 8 };
const WARM_COOL: Record<number, number> = { 10: 2, 15: 3, 20: 3, 30: 4, 45: 4, 60: 4 };
const ROUND_REST = 30;

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What the user can do here: bodyweight and a mat always, plus owned gear (gym: all). */
function usable(e: Exercise, place: FitPlace, gear: readonly Equipment[]): boolean {
  if (!e.places.includes(place)) return false;
  if (place === 'gym') return true;
  return e.equipment === 'none' || e.equipment === 'mat' || e.equipment === 'chair'
    ? true
    : gear.includes(e.equipment);
}

/** Exercises this place and gear allow, for the AI catalogue. */
export function usableExercises(place: FitPlace, gear: readonly Equipment[]): Exercise[] {
  return EXERCISES.filter((e) => usable(e, place, gear) && !LONG_CARDIO.has(e.id));
}

/** Long steady cardio (runs, walks, rowing) doesn't fit a station. */
const LONG_CARDIO = new Set(['run', 'briskWalk', 'stairClimb', 'rowErg', 'sprints']);

function candidates(choice: PackChoice, place: FitPlace, gear: readonly Equipment[]): Exercise[] {
  return EXERCISES.filter((e) => {
    if (!usable(e, place, gear) || e.level > choice.level || LONG_CARDIO.has(e.id)) return false;
    if (choice.zone === 'mobility') return e.type === 'mobility' || e.type === 'yoga';
    if (choice.zone === 'cardio') return e.type === 'cardio' || e.type === 'hiit';
    return (
      e.type === 'strength' || e.type === 'hiit' || e.type === 'pilates' || e.type === 'cardio'
    );
  });
}

function pickMain(
  choice: PackChoice,
  pool: Exercise[],
  count: number,
  gear: readonly Equipment[],
  rand: () => number,
  prefer: readonly string[] = [],
): Exercise[] {
  const picked: Exercise[] = [];
  // Exercises the AI chose come first, as long as this place, gear and level allow them.
  for (const id of prefer) {
    const e = pool.find((x) => x.id === id);
    if (e && picked.length < count && !picked.some((p) => p.id === e.id)) picked.push(e);
  }
  const score = (e: Exercise) =>
    (gear.includes(e.equipment) ? 2 : 0) + (e.level === choice.level ? 1 : 0) + rand() * 2.5;
  const take = (fits: (e: Exercise) => boolean) => {
    const best = pool
      .filter((e) => fits(e) && !picked.some((p) => p.id === e.id || p.pose === e.pose))
      .sort((a, b) => score(b) - score(a))[0];
    if (best) picked.push(best);
    return !!best;
  };
  if (choice.zone === 'cardio' || choice.zone === 'mobility') {
    while (picked.length < count && take(() => true));
    return picked;
  }
  const slots = ZONE_SLOTS[choice.zone];
  for (let i = 0; picked.length < count && i < count * 3; i++) {
    const slot = slots[i % slots.length];
    const fits =
      slot.length === 0
        ? (e: Exercise) => e.type === 'cardio' || e.type === 'hiit'
        : (e: Exercise) => e.type !== 'cardio' && slot.includes(e.muscles[0]);
    if (!take(fits)) take((e) => e.type !== 'cardio' && slots.flat().includes(e.muscles[0]));
  }
  return picked;
}

function holdSteps(ids: string[], sec: number, place: FitPlace, gear: Equipment[]): RoutineStep[] {
  return ids
    .map((id) => getExercise(id))
    .filter((e): e is Exercise => !!e && usable(e, place, gear))
    .map((e) => ({ ex: e.id, sets: 1, sec: e.sides ? Math.round(sec / 2) : sec, restSec: 5 }));
}

const scale = (n: number, level: FitLevel) =>
  Math.max(1, Math.round(n * (level === 1 ? 0.8 : level === 3 ? 1.2 : 1)));

const stepSec = (s: RoutineStep) => {
  const e = getExercise(s.ex);
  const one = typeof s.sec === 'number' ? s.sec : (s.reps ?? 0) * 3;
  return one * (e?.sides ? 2 : 1);
};

export function packSeconds(steps: RoutineStep[]): number {
  return steps.reduce((t, s, i) => {
    const rests = i === steps.length - 1 ? s.sets - 1 : s.sets;
    return t + s.sets * stepSec(s) + Math.max(0, rests) * s.restSec;
  }, 0);
}

/** Builds a pack; null when nothing in the library fits (e.g. odd place + gear). */
export function buildPack(
  choice: PackChoice,
  place: FitPlace,
  gear: Equipment[],
  seed: number,
  prefer: readonly string[] = [],
): Pack | null {
  const rand = rng(seed);
  const pool = candidates(choice, place, gear);
  const warmCount = WARM_COOL[choice.minutes] ?? 3;
  const warmIds =
    choice.zone === 'mobility' ? [] : [...WARMUP].sort(() => rand() - 0.5).slice(0, warmCount);
  const coolIds = COOLDOWN[choice.zone].slice(0, warmCount);
  const warm = holdSteps(warmIds, 30, place, gear);
  const cool = holdSteps(coolIds, 40, place, gear);
  const mainSec = Math.max(
    180,
    choice.minutes * 60 - packSeconds(warm) - packSeconds(cool) - (warm.length ? 10 : 0),
  );

  let main: RoutineStep[] = [];
  let picked: Exercise[] = [];
  let rounds = 1;
  let [work, rest] = CIRCUIT[choice.level];

  if (choice.format === 'sets' && choice.zone !== 'mobility') {
    const sets = choice.level === 1 ? 2 : choice.level === 2 ? 3 : 4;
    rounds = sets;
    picked = pickMain(choice, pool, SETS_EX[choice.minutes] ?? 4, gear, rand, prefer);
    const restFor = (e: Exercise) =>
      e.type === 'hiit' || e.type === 'cardio' ? 30 : choice.level === 3 ? 75 : 60;
    main = picked.map((e) =>
      e.mode === 'time'
        ? { ex: e.id, sets, sec: scale(e.sec ?? 30, choice.level), restSec: restFor(e) }
        : { ex: e.id, sets, reps: scale(e.reps ?? 10, choice.level), restSec: restFor(e) },
    );
    while (main.length > 2 && packSeconds(main) > mainSec) main.pop();
    picked = picked.slice(0, main.length);
  } else if (choice.format === 'tabata' && choice.zone !== 'mobility') {
    [work, rest] = [20, 10];
    const blocks = Math.max(1, Math.round(mainSec / (8 * 30 + 60)));
    rounds = blocks;
    picked = pickMain(choice, pool, blocks * 2, gear, rand, prefer);
    for (let b = 0; b < blocks && picked.length >= 2; b++) {
      const pair = [picked[(b * 2) % picked.length], picked[(b * 2 + 1) % picked.length]];
      for (let i = 0; i < 8; i++) {
        const e = pair[i % 2];
        main.push({
          ex: e.id,
          sets: 1,
          sec: e.sides ? 10 : 20,
          restSec: i === 7 && b < blocks - 1 ? 60 : 10,
        });
      }
    }
  } else {
    // Circuit (and every mobility session): timed stations, rounds to fill the time.
    if (choice.zone === 'mobility') [work, rest] = [45, 10];
    const count = STATIONS[choice.minutes] ?? 5;
    picked = pickMain(choice, pool, count, gear, rand, prefer);
    const per = picked.length * (work + rest) + ROUND_REST;
    rounds = Math.max(1, Math.min(8, Math.round(mainSec / Math.max(1, per))));
    for (let r = 0; r < rounds; r++) {
      picked.forEach((e, i) => {
        const last = i === picked.length - 1;
        main.push({
          ex: e.id,
          sets: 1,
          sec: e.sides ? Math.round(work / 2) : work,
          restSec: last && r < rounds - 1 ? rest + ROUND_REST : rest,
        });
      });
    }
  }
  if (main.length === 0) return null;
  const steps = [...warm, ...main, ...cool];
  return {
    id: packId(choice),
    choice,
    seed,
    steps,
    warmup: warm.map((s) => s.ex),
    main: picked.map((e) => e.id),
    cooldown: cool.map((s) => s.ex),
    rounds,
    workSec: work,
    restSec: rest,
    minutes: Math.max(1, Math.round(packSeconds(steps) / 60)),
  };
}
