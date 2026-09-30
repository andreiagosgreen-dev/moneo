/* Move module (stage 1): built-in exercise library + ready-made routines.
 *
 * Content is data, text is i18n: every exercise has `fit.ex.<id>.name|cue`
 * and every routine `fit.rt.<id>.name|desc` in all locales. Pure module.
 */
import type { TKey } from '../i18n/types';

export type FitCategory = 'home' | 'gym' | 'yoga' | 'stretch';
export type Muscle =
  'legs' | 'chest' | 'back' | 'core' | 'shoulders' | 'arms' | 'full' | 'mobility';
export type Equipment = 'none' | 'chair' | 'mat' | 'dumbbell' | 'barbell' | 'machine';

export const FIT_CATEGORIES: readonly FitCategory[] = ['home', 'gym', 'yoga', 'stretch'];

export type PoseId =
  | 'stand'
  | 'jack'
  | 'squat'
  | 'lunge'
  | 'pushup'
  | 'plank'
  | 'climber'
  | 'bridge'
  | 'superman'
  | 'crunch'
  | 'dip'
  | 'bench'
  | 'deadlift'
  | 'pulldown'
  | 'row'
  | 'press'
  | 'legpress'
  | 'curl'
  | 'dog'
  | 'warrior'
  | 'tree'
  | 'cobra'
  | 'child'
  | 'cat'
  | 'triangle'
  | 'fold'
  | 'seated'
  | 'twist'
  | 'lying'
  | 'shoulder'
  | 'chest'
  | 'neck';

export interface Exercise {
  id: string;
  category: FitCategory;
  muscle: Muscle;
  equipment: Equipment;
  pose: PoseId;
  /** Counted in reps, or held for a number of seconds. */
  mode: 'reps' | 'time';
  sets: number;
  reps?: number;
  sec?: number;
  /** Done once per side (time is per side). */
  sides?: boolean;
  /** Logs a weight in kg. */
  weighted?: boolean;
}

const ex = (e: Exercise): Exercise => e;

export const EXERCISES: readonly Exercise[] = [
  // Home — no equipment (a chair at most)
  ex({
    id: 'squat',
    category: 'home',
    muscle: 'legs',
    equipment: 'none',
    pose: 'squat',
    mode: 'reps',
    sets: 3,
    reps: 15,
  }),
  ex({
    id: 'pushup',
    category: 'home',
    muscle: 'chest',
    equipment: 'none',
    pose: 'pushup',
    mode: 'reps',
    sets: 3,
    reps: 10,
  }),
  ex({
    id: 'lunge',
    category: 'home',
    muscle: 'legs',
    equipment: 'none',
    pose: 'lunge',
    mode: 'reps',
    sets: 3,
    reps: 12,
  }),
  ex({
    id: 'plank',
    category: 'home',
    muscle: 'core',
    equipment: 'none',
    pose: 'plank',
    mode: 'time',
    sets: 3,
    sec: 40,
  }),
  ex({
    id: 'bridge',
    category: 'home',
    muscle: 'legs',
    equipment: 'none',
    pose: 'bridge',
    mode: 'reps',
    sets: 3,
    reps: 15,
  }),
  ex({
    id: 'climber',
    category: 'home',
    muscle: 'full',
    equipment: 'none',
    pose: 'climber',
    mode: 'time',
    sets: 3,
    sec: 30,
  }),
  ex({
    id: 'jack',
    category: 'home',
    muscle: 'full',
    equipment: 'none',
    pose: 'jack',
    mode: 'time',
    sets: 2,
    sec: 45,
  }),
  ex({
    id: 'superman',
    category: 'home',
    muscle: 'back',
    equipment: 'none',
    pose: 'superman',
    mode: 'reps',
    sets: 2,
    reps: 12,
  }),
  ex({
    id: 'crunch',
    category: 'home',
    muscle: 'core',
    equipment: 'none',
    pose: 'crunch',
    mode: 'reps',
    sets: 3,
    reps: 15,
  }),
  ex({
    id: 'chairDip',
    category: 'home',
    muscle: 'arms',
    equipment: 'chair',
    pose: 'dip',
    mode: 'reps',
    sets: 3,
    reps: 10,
  }),
  // Gym
  ex({
    id: 'backSquat',
    category: 'gym',
    muscle: 'legs',
    equipment: 'barbell',
    pose: 'squat',
    mode: 'reps',
    sets: 4,
    reps: 8,
    weighted: true,
  }),
  ex({
    id: 'benchPress',
    category: 'gym',
    muscle: 'chest',
    equipment: 'barbell',
    pose: 'bench',
    mode: 'reps',
    sets: 4,
    reps: 8,
    weighted: true,
  }),
  ex({
    id: 'deadlift',
    category: 'gym',
    muscle: 'back',
    equipment: 'barbell',
    pose: 'deadlift',
    mode: 'reps',
    sets: 3,
    reps: 5,
    weighted: true,
  }),
  ex({
    id: 'latPulldown',
    category: 'gym',
    muscle: 'back',
    equipment: 'machine',
    pose: 'pulldown',
    mode: 'reps',
    sets: 3,
    reps: 10,
    weighted: true,
  }),
  ex({
    id: 'dbRow',
    category: 'gym',
    muscle: 'back',
    equipment: 'dumbbell',
    pose: 'row',
    mode: 'reps',
    sets: 3,
    reps: 10,
    sides: true,
    weighted: true,
  }),
  ex({
    id: 'overheadPress',
    category: 'gym',
    muscle: 'shoulders',
    equipment: 'barbell',
    pose: 'press',
    mode: 'reps',
    sets: 3,
    reps: 8,
    weighted: true,
  }),
  ex({
    id: 'legPress',
    category: 'gym',
    muscle: 'legs',
    equipment: 'machine',
    pose: 'legpress',
    mode: 'reps',
    sets: 3,
    reps: 12,
    weighted: true,
  }),
  ex({
    id: 'bicepsCurl',
    category: 'gym',
    muscle: 'arms',
    equipment: 'dumbbell',
    pose: 'curl',
    mode: 'reps',
    sets: 3,
    reps: 12,
    weighted: true,
  }),
  ex({
    id: 'rdl',
    category: 'gym',
    muscle: 'legs',
    equipment: 'dumbbell',
    pose: 'deadlift',
    mode: 'reps',
    sets: 3,
    reps: 10,
    weighted: true,
  }),
  ex({
    id: 'gobletSquat',
    category: 'gym',
    muscle: 'legs',
    equipment: 'dumbbell',
    pose: 'squat',
    mode: 'reps',
    sets: 3,
    reps: 12,
    weighted: true,
  }),
  // Yoga
  ex({
    id: 'mountain',
    category: 'yoga',
    muscle: 'mobility',
    equipment: 'mat',
    pose: 'stand',
    mode: 'time',
    sets: 1,
    sec: 30,
  }),
  ex({
    id: 'downDog',
    category: 'yoga',
    muscle: 'full',
    equipment: 'mat',
    pose: 'dog',
    mode: 'time',
    sets: 2,
    sec: 45,
  }),
  ex({
    id: 'warrior2',
    category: 'yoga',
    muscle: 'legs',
    equipment: 'mat',
    pose: 'warrior',
    mode: 'time',
    sets: 1,
    sec: 30,
    sides: true,
  }),
  ex({
    id: 'tree',
    category: 'yoga',
    muscle: 'legs',
    equipment: 'mat',
    pose: 'tree',
    mode: 'time',
    sets: 1,
    sec: 30,
    sides: true,
  }),
  ex({
    id: 'cobra',
    category: 'yoga',
    muscle: 'back',
    equipment: 'mat',
    pose: 'cobra',
    mode: 'time',
    sets: 2,
    sec: 30,
  }),
  ex({
    id: 'child',
    category: 'yoga',
    muscle: 'mobility',
    equipment: 'mat',
    pose: 'child',
    mode: 'time',
    sets: 1,
    sec: 60,
  }),
  ex({
    id: 'catCow',
    category: 'yoga',
    muscle: 'back',
    equipment: 'mat',
    pose: 'cat',
    mode: 'time',
    sets: 1,
    sec: 60,
  }),
  ex({
    id: 'triangle',
    category: 'yoga',
    muscle: 'mobility',
    equipment: 'mat',
    pose: 'triangle',
    mode: 'time',
    sets: 1,
    sec: 30,
    sides: true,
  }),
  // Stretching / mobility
  ex({
    id: 'forwardFold',
    category: 'stretch',
    muscle: 'mobility',
    equipment: 'none',
    pose: 'fold',
    mode: 'time',
    sets: 1,
    sec: 45,
  }),
  ex({
    id: 'hipFlexor',
    category: 'stretch',
    muscle: 'legs',
    equipment: 'none',
    pose: 'lunge',
    mode: 'time',
    sets: 1,
    sec: 30,
    sides: true,
  }),
  ex({
    id: 'hamstring',
    category: 'stretch',
    muscle: 'legs',
    equipment: 'mat',
    pose: 'seated',
    mode: 'time',
    sets: 1,
    sec: 45,
  }),
  ex({
    id: 'chestOpener',
    category: 'stretch',
    muscle: 'chest',
    equipment: 'none',
    pose: 'chest',
    mode: 'time',
    sets: 1,
    sec: 30,
  }),
  ex({
    id: 'neckRoll',
    category: 'stretch',
    muscle: 'mobility',
    equipment: 'none',
    pose: 'neck',
    mode: 'time',
    sets: 1,
    sec: 30,
  }),
  ex({
    id: 'seatedTwist',
    category: 'stretch',
    muscle: 'back',
    equipment: 'mat',
    pose: 'twist',
    mode: 'time',
    sets: 1,
    sec: 30,
    sides: true,
  }),
  ex({
    id: 'figureFour',
    category: 'stretch',
    muscle: 'legs',
    equipment: 'mat',
    pose: 'lying',
    mode: 'time',
    sets: 1,
    sec: 30,
    sides: true,
  }),
  ex({
    id: 'shoulderCross',
    category: 'stretch',
    muscle: 'shoulders',
    equipment: 'none',
    pose: 'shoulder',
    mode: 'time',
    sets: 1,
    sec: 30,
    sides: true,
  }),
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export interface RoutineStep {
  ex: string;
  sets: number;
  reps?: number;
  sec?: number;
  /** Rest after each set, in seconds. */
  restSec: number;
}

export interface Routine {
  id: string;
  category: FitCategory;
  icon: PoseId;
  steps: RoutineStep[];
}

/** Step with the exercise defaults, optionally overriding sets/reps/sec. */
const step = (id: string, restSec: number, over: Partial<RoutineStep> = {}): RoutineStep => {
  const e = BY_ID.get(id);
  return {
    ex: id,
    sets: over.sets ?? e?.sets ?? 1,
    ...(e?.mode === 'time' ? { sec: over.sec ?? e.sec } : { reps: over.reps ?? e?.reps }),
    restSec,
  };
};

export const ROUTINES: readonly Routine[] = [
  {
    id: 'home20',
    category: 'home',
    icon: 'squat',
    steps: [
      step('squat', 25),
      step('pushup', 25),
      step('lunge', 25),
      step('bridge', 25),
      step('plank', 25),
      step('jack', 25),
      step('superman', 25),
    ],
  },
  {
    id: 'homeCore',
    category: 'home',
    icon: 'plank',
    steps: [
      step('crunch', 15, { sets: 2 }),
      step('plank', 15),
      step('climber', 15),
      step('superman', 15),
      step('bridge', 15, { sets: 2 }),
    ],
  },
  {
    id: 'gymFull',
    category: 'gym',
    icon: 'bench',
    steps: [
      step('backSquat', 90),
      step('benchPress', 90),
      step('dbRow', 75),
      step('overheadPress', 75),
      step('rdl', 75),
      step('plank', 45, { sets: 2, sec: 45 }),
    ],
  },
  {
    id: 'gymLegsBack',
    category: 'gym',
    icon: 'deadlift',
    steps: [
      step('deadlift', 120),
      step('legPress', 90),
      step('latPulldown', 75),
      step('gobletSquat', 75),
      step('bicepsCurl', 60),
    ],
  },
  {
    id: 'yogaMorning',
    category: 'yoga',
    icon: 'tree',
    steps: [
      step('mountain', 15, { sec: 60 }),
      step('catCow', 15, { sec: 90 }),
      step('downDog', 15, { sets: 3 }),
      step('warrior2', 15, { sec: 45 }),
      step('tree', 15, { sec: 45 }),
      step('triangle', 15, { sec: 45 }),
      step('cobra', 15, { sets: 3 }),
      step('child', 15, { sec: 90 }),
    ],
  },
  {
    id: 'stretchEvening',
    category: 'stretch',
    icon: 'seated',
    steps: [
      step('neckRoll', 10),
      step('shoulderCross', 10, { sec: 45 }),
      step('chestOpener', 10),
      step('forwardFold', 10),
      step('hipFlexor', 10, { sec: 45 }),
      step('hamstring', 10),
      step('seatedTwist', 10, { sec: 45 }),
      step('figureFour', 10, { sec: 45 }),
    ],
  },
];

export function getRoutine(id: string): Routine | undefined {
  return ROUTINES.find((r) => r.id === id);
}

/** Seconds a rep takes on average, for time estimates only. */
const SEC_PER_REP = 3;

/** Work seconds of one set of a step (both sides counted). */
export function setWorkSec(s: RoutineStep): number {
  const e = BY_ID.get(s.ex);
  const sides = e?.sides ? 2 : 1;
  const one = typeof s.sec === 'number' ? s.sec : (s.reps ?? 0) * SEC_PER_REP;
  return one * sides;
}

/** Rough duration in whole minutes (work + rest between sets). */
export function routineMinutes(r: Routine): number {
  let total = 0;
  r.steps.forEach((s, i) => {
    total += s.sets * setWorkSec(s);
    const rests = i === r.steps.length - 1 ? s.sets - 1 : s.sets;
    total += Math.max(0, rests) * s.restSec;
  });
  return Math.max(1, Math.round(total / 60));
}

export const fitKey = {
  exName: (id: string) => `fit.ex.${id}.name` as TKey,
  exCue: (id: string) => `fit.ex.${id}.cue` as TKey,
  rtName: (id: string) => `fit.rt.${id}.name` as TKey,
  rtDesc: (id: string) => `fit.rt.${id}.desc` as TKey,
  cat: (c: FitCategory) => `fit.cat.${c}` as TKey,
  muscle: (m: Muscle) => `fit.muscle.${m}` as TKey,
  eq: (e: Equipment) => `fit.eq.${e}` as TKey,
};
