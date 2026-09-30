/* Move module: the personal program (Pro).
 *
 * Six answers turn into a 4–8 week plan: two or three session templates
 * picked from the library for the user's place, equipment and level, spread
 * over fixed weekdays. Each week adds a little (reps or seconds, then a set
 * in the second half). Local and deterministic: same answers, same program.
 */
import {
  EXERCISES,
  FIT_PLACES,
  FIT_TYPES,
  exerciseStep,
  routineMinutes,
  type Equipment,
  type Exercise,
  type FitLevel,
  type FitPlace,
  type FitType,
  type Muscle,
  type RoutineStep,
} from './library';
import { cleanStep } from './custom';

export type ProgramGoal = 'strength' | 'fit' | 'mobility' | 'general';
export const PROGRAM_GOALS: readonly ProgramGoal[] = ['strength', 'fit', 'mobility', 'general'];
export type ProgramFocus = 'full' | 'upper' | 'lower' | 'cond' | 'mobility';

export const PROGRAM_DAYS = [2, 3, 4, 5] as const;
export const PROGRAM_MINUTES = [15, 30, 45, 60] as const;
export const PROGRAM_WEEKS = [4, 6, 8] as const;
/** Equipment worth asking about at home or outdoors (the gym has everything). */
export const PROGRAM_GEAR: readonly Equipment[] = [
  'dumbbell',
  'kettlebell',
  'band',
  'pullupBar',
  'bench',
  'rope',
];

export interface ProgramAnswers {
  goal: ProgramGoal;
  level: FitLevel;
  place: FitPlace;
  gear: Equipment[];
  days: number;
  minutes: number;
  weeks: number;
}

export interface ProgramSession {
  /** "A", "B", "C" — routine id is `p-<key>`. */
  key: string;
  focus: ProgramFocus;
  /** Week 1 doses; later weeks are derived by `progressStep`. */
  steps: RoutineStep[];
}

export interface Program {
  answers: ProgramAnswers;
  /** Local Monday 00:00 of week 1. */
  startedAt: number;
  /** Training weekdays, 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
  sessions: ProgramSession[];
}

const PREFIX = 'p-';
const WEEK_MS = 7 * 86_400_000;
const MAX_STEPS = 10;

export const isProgramId = (id: string) => id.startsWith(PREFIX);
export const programRoutineId = (key: string) => `${PREFIX}${key}`;

export const DEFAULT_ANSWERS: ProgramAnswers = {
  goal: 'general',
  level: 1,
  place: 'home',
  gear: [],
  days: 3,
  minutes: 30,
  weeks: 6,
};

const WEEKDAYS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
};

function focusesFor(goal: ProgramGoal, days: number): ProgramFocus[] {
  if (goal === 'strength') return days >= 4 ? ['upper', 'lower'] : ['full', 'full'];
  if (goal === 'fit') return ['cond', 'full'];
  if (goal === 'mobility') return ['mobility', 'mobility'];
  return days >= 3 ? ['full', 'cond', 'mobility'] : ['full', 'cond'];
}

type Slot = { muscle?: Muscle; types: readonly FitType[] };
const STRENGTH: readonly FitType[] = ['strength'];
const CONDITION: readonly FitType[] = ['hiit', 'cardio'];
const SUPPLE: readonly FitType[] = ['yoga', 'mobility', 'pilates'];
const s = (muscle: Muscle, types: readonly FitType[] = STRENGTH): Slot => ({ muscle, types });

const SLOTS: Record<ProgramFocus, readonly Slot[]> = {
  full: [
    s('quads'),
    s('chest'),
    s('lats'),
    s('hamstrings'),
    s('shoulders'),
    s('abs'),
    s('glutes'),
    s('triceps'),
    s('biceps'),
    s('calves'),
  ],
  upper: [
    s('chest'),
    s('lats'),
    s('shoulders'),
    s('triceps'),
    s('biceps'),
    s('abs'),
    s('traps'),
    s('obliques'),
  ],
  lower: [
    s('quads'),
    s('hamstrings'),
    s('glutes'),
    s('calves'),
    s('abs'),
    s('lowerBack'),
    s('adductors'),
    s('obliques'),
  ],
  cond: [
    { types: CONDITION },
    s('quads'),
    { types: CONDITION },
    s('chest'),
    { types: CONDITION },
    s('abs'),
    s('glutes'),
    s('lats'),
  ],
  mobility: [
    { muscle: 'hamstrings', types: SUPPLE },
    { muscle: 'shoulders', types: SUPPLE },
    { muscle: 'lowerBack', types: SUPPLE },
    { muscle: 'glutes', types: SUPPLE },
    { muscle: 'abs', types: SUPPLE },
    { muscle: 'chest', types: SUPPLE },
    { muscle: 'quads', types: SUPPLE },
    { muscle: 'obliques', types: SUPPLE },
  ],
};

/** Exercises the user can actually do with the answers given. */
export function programPool(a: ProgramAnswers): Exercise[] {
  const gear = new Set<Equipment>(['none', 'mat', 'chair', ...a.gear]);
  return EXERCISES.filter(
    (e) =>
      e.places.includes(a.place) &&
      e.level <= a.level &&
      (a.place === 'gym' || gear.has(e.equipment)),
  );
}

function pickFor(slot: Slot, pool: Exercise[], taken: Set<string>, level: FitLevel) {
  const fits = pool.filter(
    (e) => slot.types.includes(e.type) && (!slot.muscle || e.muscles.includes(slot.muscle)),
  );
  const score = (e: Exercise) =>
    (slot.muscle && e.muscles[0] === slot.muscle ? 4 : 0) +
    (taken.has(e.id) ? -10 : 0) +
    (e.level === level ? 1 : 0) +
    (e.weighted && slot.types === STRENGTH ? 0.5 : 0);
  return fits
    .map((e) => ({ e, v: score(e) }))
    .sort((x, y) => y.v - x.v || x.e.id.localeCompare(y.e.id))[0]?.e;
}

function baseStep(goal: ProgramGoal, level: FitLevel, ex: Exercise): RoutineStep {
  const st = exerciseStep(ex.id);
  if (goal === 'mobility' || SUPPLE.includes(ex.type)) {
    return { ...st, sets: 2, restSec: 10 };
  }
  if (CONDITION.includes(ex.type)) {
    return { ...st, sets: 3, restSec: goal === 'fit' ? 20 : 30 };
  }
  const rest = goal === 'strength' ? (level === 1 ? 60 : 90) : goal === 'fit' ? 30 : 45;
  const reps =
    st.reps !== undefined && goal === 'strength' && ex.weighted ? Math.min(st.reps, 10) : st.reps;
  return { ...st, sets: 3, restSec: rest, ...(reps !== undefined ? { reps } : {}) };
}

function buildSession(
  a: ProgramAnswers,
  focus: ProgramFocus,
  pool: Exercise[],
  taken: Set<string>,
): RoutineStep[] {
  const steps: RoutineStep[] = [];
  const used = new Set<string>();
  const full = () =>
    steps.length >= MAX_STEPS ||
    (steps.length >= 3 &&
      routineMinutes({ id: '', places: [], type: 'strength', icon: 'squat', steps }) >= a.minutes);
  const add = (slot: Slot) => {
    const ex = pickFor(
      slot,
      pool.filter((e) => !used.has(e.id)),
      taken,
      a.level,
    );
    if (!ex) return false;
    used.add(ex.id);
    taken.add(ex.id);
    steps.push(baseStep(a.goal, a.level, ex));
    return true;
  };
  for (const slot of SLOTS[focus]) {
    if (full()) break;
    add(slot);
  }
  // Thin pools (few exercises for a place or level): top up with the same kind of work.
  const kinds = [...new Set(SLOTS[focus].flatMap((x) => x.types))];
  let more = true;
  while (more && !full()) {
    more = add({ types: kinds }) || (steps.length < 3 && add({ types: FIT_TYPES }));
  }
  return steps;
}

/** Local Monday 00:00 of the week containing `now`. */
export function mondayOf(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

const clampTo = <T extends number>(v: number, options: readonly T[], fallback: T): T =>
  (options as readonly number[]).includes(v) ? (v as T) : fallback;

export function cleanAnswers(v: unknown): ProgramAnswers | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  if (!PROGRAM_GOALS.includes(a.goal as ProgramGoal)) return null;
  if (!FIT_PLACES.includes(a.place as FitPlace)) return null;
  const gear = Array.isArray(a.gear)
    ? [...new Set(a.gear.filter((g): g is Equipment => PROGRAM_GEAR.includes(g as Equipment)))]
    : [];
  return {
    goal: a.goal as ProgramGoal,
    level: clampTo(Number(a.level), [1, 2, 3] as const, 1),
    place: a.place as FitPlace,
    gear,
    days: clampTo(Number(a.days), PROGRAM_DAYS, 3),
    minutes: clampTo(Number(a.minutes), PROGRAM_MINUTES, 30),
    weeks: clampTo(Number(a.weeks), PROGRAM_WEEKS, 6),
  };
}

/** A fresh program starting this week. Null when the library has nothing that fits. */
export function buildProgram(answers: ProgramAnswers, now: number = Date.now()): Program | null {
  const a = cleanAnswers(answers);
  if (!a) return null;
  const pool = programPool(a);
  const taken = new Set<string>();
  const sessions: ProgramSession[] = [];
  focusesFor(a.goal, a.days).forEach((focus, i) => {
    const steps = buildSession(a, focus, pool, taken);
    if (steps.length > 0) sessions.push({ key: String.fromCharCode(65 + i), focus, steps });
  });
  if (sessions.length === 0) return null;
  return { answers: a, startedAt: mondayOf(now), weekdays: WEEKDAYS[a.days], sessions };
}

const FOCI: readonly ProgramFocus[] = ['full', 'upper', 'lower', 'cond', 'mobility'];

export function cleanProgram(v: unknown): Program | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const answers = cleanAnswers(p.answers);
  if (!answers || typeof p.startedAt !== 'number' || !Number.isFinite(p.startedAt)) return null;
  const sessions = Array.isArray(p.sessions)
    ? p.sessions
        .map((raw): ProgramSession | null => {
          if (!raw || typeof raw !== 'object') return null;
          const r = raw as Record<string, unknown>;
          if (typeof r.key !== 'string' || !/^[A-E]$/.test(r.key)) return null;
          if (!FOCI.includes(r.focus as ProgramFocus) || !Array.isArray(r.steps)) return null;
          const steps = r.steps
            .map(cleanStep)
            .filter((x): x is RoutineStep => x !== null)
            .slice(0, MAX_STEPS);
          return steps.length > 0 ? { key: r.key, focus: r.focus as ProgramFocus, steps } : null;
        })
        .filter((x): x is ProgramSession => x !== null)
    : [];
  if (sessions.length === 0) return null;
  return { answers, startedAt: p.startedAt, weekdays: WEEKDAYS[answers.days], sessions };
}

/** 0-based week of the program; ≥ weeks means finished, < 0 not started. */
export function programWeek(p: Program, now: number = Date.now()): number {
  return Math.round((mondayOf(now) - p.startedAt) / WEEK_MS);
}

export const isProgramActive = (p: Program | undefined, now: number = Date.now()): p is Program => {
  if (!p) return false;
  const w = programWeek(p, now);
  return w >= 0 && w < p.answers.weeks;
};

export const isProgramFinished = (p: Program | undefined, now: number = Date.now()) =>
  !!p && programWeek(p, now) >= p.answers.weeks;

/**
 * Dose for week `week` (0-based): +1 rep or +5 s a week (up to 4 weeks of
 * gains), and one extra set from the second half of the program on.
 */
export function progressStep(st: RoutineStep, week: number, weeks: number): RoutineStep {
  const w = Math.max(0, Math.min(week, weeks - 1));
  const gain = Math.min(w, 4);
  const extraSet = w >= Math.ceil(weeks / 2) ? 1 : 0;
  const out: RoutineStep = { ...st, sets: Math.min(5, st.sets + extraSet) };
  if (typeof st.sec === 'number') out.sec = st.sec + gain * 5;
  if (typeof st.reps === 'number') out.reps = st.reps + gain;
  return out;
}

export function programSession(p: Program, id: string): ProgramSession | undefined {
  return isProgramId(id) ? p.sessions.find((x) => programRoutineId(x.key) === id) : undefined;
}

/** Steps of a session for the week containing `now`. */
export function programSteps(p: Program, id: string, now: number = Date.now()): RoutineStep[] {
  const session = programSession(p, id);
  if (!session) return [];
  const week = programWeek(p, now);
  return session.steps.map((st) => progressStep(st, week, p.answers.weeks));
}

/** Session ids per training weekday: sessions rotate A, B, (C), A, … */
export function programSchedule(p: Program): Map<number, string> {
  const out = new Map<number, string>();
  p.weekdays.forEach((wd, i) => {
    out.set(wd, programRoutineId(p.sessions[i % p.sessions.length].key));
  });
  return out;
}

/** Session scheduled on a local day key, if the program runs that week. */
export function programOn(p: Program | undefined, dayKey: string): string | undefined {
  if (!p) return undefined;
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const t = date.getTime();
  if (!Number.isFinite(t) || !isProgramActive(p, t)) return undefined;
  return programSchedule(p).get(date.getDay());
}
