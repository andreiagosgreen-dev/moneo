/* Move module: exercise taxonomy, ready-made routines and library queries.
 *
 * Content is data, text is i18n: every exercise has `fit.ex.<id>.name|cue|tip`
 * and every routine `fit.rt.<id>.name|desc` in all locales. Pure module.
 */
import type { TKey } from '../i18n/types';
import { EXERCISES } from './exercises';

export { EXERCISES };

export type FitPlace = 'home' | 'outdoor' | 'gym';
export const FIT_PLACES: readonly FitPlace[] = ['home', 'outdoor', 'gym'];

export type FitType = 'strength' | 'cardio' | 'hiit' | 'yoga' | 'mobility' | 'pilates';
export const FIT_TYPES: readonly FitType[] = [
  'strength',
  'cardio',
  'hiit',
  'yoga',
  'mobility',
  'pilates',
];

export type Muscle =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'traps'
  | 'lats'
  | 'lowerBack'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';
export const MUSCLES: readonly Muscle[] = [
  'chest',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'traps',
  'lats',
  'lowerBack',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
];

export type Equipment =
  | 'none'
  | 'mat'
  | 'chair'
  | 'band'
  | 'rope'
  | 'dumbbell'
  | 'kettlebell'
  | 'pullupBar'
  | 'bench'
  | 'barbell'
  | 'machine'
  | 'cable';
export const EQUIPMENT: readonly Equipment[] = [
  'none',
  'mat',
  'chair',
  'band',
  'rope',
  'dumbbell',
  'kettlebell',
  'pullupBar',
  'bench',
  'barbell',
  'machine',
  'cable',
];

export type FitLevel = 1 | 2 | 3;

export type PoseId =
  | 'stand'
  | 'jack'
  | 'squat'
  | 'lunge'
  | 'pushup'
  | 'pushlow'
  | 'plank'
  | 'climber'
  | 'bridge'
  | 'supine'
  | 'supinestraight'
  | 'prone'
  | 'superman'
  | 'crunch'
  | 'dip'
  | 'diplow'
  | 'bench'
  | 'benchdown'
  | 'deadlift'
  | 'deadtop'
  | 'pulldown'
  | 'pulldown2'
  | 'row'
  | 'press'
  | 'pressdown'
  | 'legpress'
  | 'legpress2'
  | 'curl'
  | 'dog'
  | 'pikelow'
  | 'warrior'
  | 'warrior1'
  | 'tree'
  | 'cobra'
  | 'child'
  | 'cat'
  | 'quad'
  | 'triangle'
  | 'fold'
  | 'seated'
  | 'twist'
  | 'twistlie'
  | 'lying'
  | 'shoulder'
  | 'chest'
  | 'neck'
  | 'wallsit'
  | 'sidelunge'
  | 'stepup'
  | 'tiptoe'
  | 'kickback'
  | 'birddog'
  | 'kneeplank'
  | 'kneelow'
  | 'inclinepush'
  | 'inclinelow'
  | 'hang'
  | 'pullup'
  | 'hangknee'
  | 'invrow'
  | 'sideplank'
  | 'bicycle'
  | 'legraise'
  | 'vsit'
  | 'deadbug'
  | 'hollow'
  | 'jumpup'
  | 'run'
  | 'walk'
  | 'box'
  | 'bear'
  | 'rowerg'
  | 'swing'
  | 'carry'
  | 'pullapart'
  | 'seatedrow'
  | 'raise'
  | 'ohext'
  | 'ohext2'
  | 'shrug'
  | 'hipthrust'
  | 'legext'
  | 'legcurl'
  | 'incline'
  | 'cablefly'
  | 'seatpress'
  | 'bentrow'
  | 'pushdown'
  | 'chop'
  | 'backext'
  | 'chairpose'
  | 'pigeon'
  | 'crow'
  | 'butterfly'
  | 'quadstretch'
  | 'calfstretch'
  | 'ohstretch'
  | 'sidelying'
  | 'clam';

export interface Exercise {
  id: string;
  /** Where it can be done. */
  places: readonly FitPlace[];
  type: FitType;
  /** Main muscle first, then secondary ones. */
  muscles: readonly Muscle[];
  equipment: Equipment;
  pose: PoseId;
  /** Second frame of the demo animation. */
  pose2?: PoseId;
  /** Counted in reps, or held for a number of seconds. */
  mode: 'reps' | 'time';
  sets: number;
  reps?: number;
  sec?: number;
  /** Done once per side (time is per side). */
  sides?: boolean;
  /** Logs a weight in kg. */
  weighted?: boolean;
  level: FitLevel;
}

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export interface ExerciseFilter {
  place?: FitPlace;
  type?: FitType;
  muscle?: Muscle;
  equipment?: Equipment;
  query?: string;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Library query; `nameOf` lets the search match translated names. */
export function filterExercises(
  f: ExerciseFilter,
  nameOf: (id: string) => string = (id) => id,
  list: readonly Exercise[] = EXERCISES,
): Exercise[] {
  const q = f.query ? fold(f.query) : '';
  return list.filter(
    (e) =>
      (!f.place || e.places.includes(f.place)) &&
      (!f.type || e.type === f.type) &&
      (!f.muscle || e.muscles.includes(f.muscle)) &&
      (!f.equipment || e.equipment === f.equipment) &&
      (!q || fold(nameOf(e.id)).includes(q) || fold(e.id).includes(q)),
  );
}

/** Same main muscle, ranked by shared muscles and usefulness elsewhere. */
export function exerciseAlternatives(ex: Exercise, limit = 4): Exercise[] {
  const score = (c: Exercise) =>
    c.muscles.filter((m) => ex.muscles.includes(m)).length +
    (c.type === ex.type ? 2 : 0) +
    (c.places.some((p) => !ex.places.includes(p)) ? 1 : 0) -
    Math.abs(c.level - ex.level) * 0.5;
  return EXERCISES.filter((c) => c.id !== ex.id && c.muscles[0] === ex.muscles[0])
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s || a.c.id.localeCompare(b.c.id))
    .slice(0, limit)
    .map((r) => r.c);
}

/** One step down / up in difficulty for the same main muscle and type. */
export function exerciseSteps(ex: Exercise): { easier?: Exercise; harder?: Exercise } {
  const pick = (level: number) =>
    EXERCISES.filter(
      (c) =>
        c.id !== ex.id && c.level === level && c.type === ex.type && c.muscles[0] === ex.muscles[0],
    ).sort(
      (a, b) =>
        b.places.filter((p) => ex.places.includes(p)).length -
          a.places.filter((p) => ex.places.includes(p)).length || a.id.localeCompare(b.id),
    )[0];
  return { easier: pick(ex.level - 1), harder: pick(ex.level + 1) };
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
  places: readonly FitPlace[];
  type: FitType;
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
    places: ['home', 'outdoor'],
    type: 'strength',
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
    places: ['home'],
    type: 'strength',
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
    id: 'homeDumbbell',
    places: ['home'],
    type: 'strength',
    icon: 'curl',
    steps: [
      step('gobletSquat', 60),
      step('dbShoulderPress', 60),
      step('dbRow', 45),
      step('rdl', 60),
      step('hammerCurl', 45),
      step('tricepsExtension', 45),
    ],
  },
  {
    id: 'hiit15',
    places: ['home', 'outdoor'],
    type: 'hiit',
    icon: 'jumpup',
    steps: [
      step('jack', 15, { sets: 2, sec: 30 }),
      step('highKnees', 15),
      step('jumpSquat', 20),
      step('climber', 15),
      step('skaterJump', 20),
      step('burpee', 30),
      step('plank', 15, { sets: 2, sec: 30 }),
    ],
  },
  {
    id: 'parkWorkout',
    places: ['outdoor'],
    type: 'strength',
    icon: 'stepup',
    steps: [
      step('inclinePushup', 45),
      step('stepUp', 45),
      step('benchDip', 45),
      step('reverseLunge', 45),
      step('invertedRow', 60),
      step('calfRaise', 30),
      step('sidePlank', 30, { sets: 2 }),
    ],
  },
  {
    id: 'runIntervals',
    places: ['outdoor'],
    type: 'cardio',
    icon: 'run',
    steps: [
      step('briskWalk', 30, { sec: 300 }),
      step('sprints', 60),
      step('briskWalk', 0, { sec: 300 }),
    ],
  },
  {
    id: 'gymFull',
    places: ['gym'],
    type: 'strength',
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
    places: ['gym'],
    type: 'strength',
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
    places: ['home', 'outdoor'],
    type: 'yoga',
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
    id: 'pilatesCore',
    places: ['home'],
    type: 'pilates',
    icon: 'hollow',
    steps: [
      step('hundred', 15),
      step('rollUp', 20),
      step('singleLegStretch', 20),
      step('swimming', 15),
      step('sideLegLift', 15),
      step('clamshell', 15),
      step('teaser', 20),
    ],
  },
  {
    id: 'stretchEvening',
    places: ['home', 'gym'],
    type: 'mobility',
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
  exTip: (id: string) => `fit.ex.${id}.tip` as TKey,
  rtName: (id: string) => `fit.rt.${id}.name` as TKey,
  rtDesc: (id: string) => `fit.rt.${id}.desc` as TKey,
  place: (p: FitPlace) => `fit.place.${p}` as TKey,
  type: (t: FitType) => `fit.type.${t}` as TKey,
  muscle: (m: Muscle) => `fit.muscle.${m}` as TKey,
  eq: (e: Equipment) => `fit.eq.${e}` as TKey,
  level: (l: FitLevel) => `fit.level.${l}` as TKey,
};
