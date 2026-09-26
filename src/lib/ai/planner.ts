/**
 * Local deterministic planning engine (Faza 6).
 *
 * No model, no network: a big goal becomes quarters → milestones →
 * Pomodoro-estimated tasks, then a capacity-aware week draft. All text
 * frames come from small template tables (translated in the UI layer);
 * the user's own goal text is woven in verbatim and NEVER interpreted
 * as instructions — by construction there is nothing to inject into.
 */

import { nextDayKey } from '../ritual';
import type {
  BuiltPath,
  ClarifyId,
  PathAssumption,
  PathInput,
  PathKind,
  PlannedTask,
  ResolvedPathInput,
  WeekDraft,
} from './types';

export const MAX_DRAFT_TASKS = 20;
export const MAX_TASKS_PER_DAY = 3;
export const POMODORO_MIN = 25;

const KIND_PATTERNS: Array<{ kind: PathKind; re: RegExp }> = [
  {
    kind: 'build',
    re: /drone|dronă|drona|robot|hardware|pcb|prototype|prototip|diy|solder|firmware|quad(?:copter)?|airframe|bom\b|assembl|construiesc|construire|construire|fabric|maker|3d\s*print|cnc|electronics|electron/i,
  },
  {
    kind: 'learning',
    re: /learn|study|cours|curs|tutorial|language|limb|limbă|învăț|învăța|invat|англий|учи|учу|вчити|lernen|impar|appr|aprender/i,
  },
  {
    kind: 'launch',
    re: /launch|startup|product|produs|business|afacer|saas|app\b|mvp|lansa|запуск|продукт|startap|start-up|lancer|lanzar/i,
  },
];

/** Classify the goal coarsely from keywords (transparent, auditable). */
export function detectKind(text: string): PathKind {
  for (const { kind, re } of KIND_PATTERNS) {
    if (re.test(text)) return kind;
  }
  return 'general';
}

/** Which inputs are still missing — ask only for these, nothing more. */
export function neededInputs(input: PathInput): ClarifyId[] {
  const out: ClarifyId[] = [];
  if (!input.horizonMonths || input.horizonMonths <= 0) out.push('horizon');
  if (!input.level) out.push('level');
  if (!input.hoursPerWeek || input.hoursPerWeek <= 0) out.push('hours');
  return out;
}

export function resolveInput(input: PathInput): ResolvedPathInput {
  return {
    text: input.text.trim(),
    horizonMonths: Math.min(480, Math.max(1, Math.round(input.horizonMonths ?? 6))),
    level: input.level ?? 'beginner',
    hoursPerWeek: Math.min(40, Math.max(1, Math.round(input.hoursPerWeek ?? 5))),
    ...(input.kind ? { kind: input.kind } : {}),
  };
}

/* Template-frame ids — the UI layer translates them; the engine only
 * references them. Frames take {goal} and {outcome} vars. */
const OUTCOME_FRAMES = [
  'ai.tpl.phaseFoundation',
  'ai.tpl.phaseBuild',
  'ai.tpl.phaseProof',
  'ai.tpl.phasePolish',
];

export const PHASE_OUTCOME_FRAMES: Record<PathKind, string[]> = {
  learning: [...OUTCOME_FRAMES],
  launch: [...OUTCOME_FRAMES],
  build: ['ai.tpl.phaseSpec', 'ai.tpl.phaseParts', 'ai.tpl.phaseAssemble', 'ai.tpl.phaseMaiden'],
  general: [...OUTCOME_FRAMES],
};

const TASK_FRAMES: Record<PathKind, string[]> = {
  learning: [
    'ai.tpl.taskStudy',
    'ai.tpl.taskDrill',
    'ai.tpl.taskProof',
    'ai.tpl.taskReview',
    'ai.tpl.taskTeachback',
  ],
  launch: [
    'ai.tpl.taskResearch',
    'ai.tpl.taskBuild',
    'ai.tpl.taskShip',
    'ai.tpl.taskMeasure',
    'ai.tpl.taskHarden',
  ],
  build: [
    'ai.tpl.taskSpec',
    'ai.tpl.taskBom',
    'ai.tpl.taskAssembleHw',
    'ai.tpl.taskIntegrate',
    'ai.tpl.taskBench',
    'ai.tpl.taskMaiden',
    'ai.tpl.taskIterateHw',
  ],
  general: [
    'ai.tpl.taskDefine',
    'ai.tpl.taskExecute',
    'ai.tpl.taskReviewWork',
    'ai.tpl.taskImprove',
    'ai.tpl.taskClose',
  ],
};

const BASE_POMODOROS: Record<ResolvedPathInput['level'], number> = {
  beginner: 3,
  intermediate: 2,
  advanced: 2,
};

export interface FrameRenderer {
  (frame: string, vars: Record<string, string | number>): string;
}

const identityFrame: FrameRenderer = (frame, vars) => {
  let out = frame;
  for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
};

function shortGoal(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

/**
 * Goal → quarters → 2 milestones/quarter → 3 tasks/milestone (bounded).
 * Pure and deterministic: the same input always yields the same path.
 */
export function buildPath(
  input: ResolvedPathInput,
  render: FrameRenderer = identityFrame,
): BuiltPath {
  const kind = input.kind ?? detectKind(input.text);
  const goal = shortGoal(input.text);
  const quarters = Math.max(1, Math.ceil(input.horizonMonths / 3));
  const outcomeFrames = PHASE_OUTCOME_FRAMES[kind];

  const phases: BuiltPath['phases'] = [];
  const milestones: BuiltPath['milestones'] = [];
  const tasks: PlannedTask[] = [];
  const assumptions: PathAssumption[] = [];

  const frames = TASK_FRAMES[kind];
  const base = BASE_POMODOROS[input.level];
  let frameIdx = 0;
  let taskIdx = 0;

  for (let q = 0; q < quarters; q++) {
    const startMonth = q * 3 + 1;
    const endMonth = Math.min(input.horizonMonths, startMonth + 2);
    const outcome = render(outcomeFrames[Math.min(q, outcomeFrames.length - 1)], { goal });
    const phaseId = `phase-${q + 1}`;
    phases.push({ id: phaseId, index: q + 1, months: [startMonth, endMonth], outcome });

    for (let m = 0; m < 2; m++) {
      const milestoneId = `ms-${q + 1}-${m + 1}`;
      const title = render(m === 0 ? 'ai.tpl.msSetup' : 'ai.tpl.msDeliver', { outcome });
      milestones.push({ id: milestoneId, phaseId, title });
      for (let t = 0; t < 3; t++) {
        if (tasks.length >= MAX_DRAFT_TASKS) break;
        taskIdx += 1;
        const frame = frames[frameIdx % frames.length];
        frameIdx += 1;
        tasks.push({
          draftId: `draft-${taskIdx}`,
          milestoneId,
          title: render(frame, { goal, outcome }),
          pomodoros: base,
          priority: m === 0 && t === 0 ? 'p1' : t === 0 ? 'p2' : 'p3',
        });
      }
    }
  }

  const theoreticalMax = quarters * 2 * 3;
  if (theoreticalMax > MAX_DRAFT_TASKS && !assumptions.includes('trimmed-to-20')) {
    assumptions.push('trimmed-to-20');
  }

  const totalPomodoros = tasks.reduce((s, x) => s + x.pomodoros, 0);
  const totalHours = (totalPomodoros * POMODORO_MIN) / 60;
  const weeks = Math.max(1, (input.horizonMonths * 365) / 12 / 7);
  const fitsCapacity = totalHours <= input.hoursPerWeek * weeks;
  if (!fitsCapacity && !assumptions.includes('tight-capacity')) {
    assumptions.push('tight-capacity');
  }

  return {
    goal,
    kind,
    horizonMonths: input.horizonMonths,
    level: input.level,
    hoursPerWeek: input.hoursPerWeek,
    phases,
    milestones,
    tasks,
    totalPomodoros,
    fitsCapacity,
    assumptions,
  };
}

/**
 * Spread draft tasks over 7 days from startKey without overfilling any
 * day: at most MAX_TASKS_PER_DAY tasks and capacityMinPerDay minutes.
 * Leftovers return as `unscheduled` — the day is never stuffed.
 */
export function draftWeek(
  tasks: Array<{ title: string; pomodoros: number }>,
  startKey: string,
  capacityMinPerDay: number[],
  pomodoroMin: number = POMODORO_MIN,
): WeekDraft {
  const days: WeekDraft['days'] = [];
  let key = startKey;
  for (let d = 0; d < 7; d++) {
    days.push({ dateKey: key, items: [], minutes: 0 });
    key = nextDayKey(key);
  }
  const unscheduled: WeekDraft['unscheduled'] = [];
  for (const task of tasks) {
    const minutes = Math.max(1, Math.round(task.pomodoros)) * Math.max(5, pomodoroMin);
    let placed = false;
    for (let d = 0; d < 7; d++) {
      const cap = capacityMinPerDay[d] ?? 0;
      const day = days[d];
      if (day.items.length >= MAX_TASKS_PER_DAY) continue;
      if (day.minutes + minutes > cap) continue;
      day.items.push({ title: task.title, pomodoros: task.pomodoros });
      day.minutes += minutes;
      placed = true;
      break;
    }
    if (!placed) unscheduled.push({ title: task.title, pomodoros: task.pomodoros });
  }
  return { days, unscheduled };
}

export interface ReplanResult {
  /** Blocked tasks shrunk to a 10-minute re-entry version. */
  shrunk: Array<{ from: string; to: string }>;
  /** Open, unblocked tasks in priority order — the new attack order. */
  nextFocus: string[];
  /** Done titles, for the review line. */
  cleared: string[];
}

/**
 * Weekly review replanning: done is cleared, blocked shrinks to a
 * 10-minute version (never deleted), the rest re-sorts by priority.
 */
export function replanTasks(
  tasks: Array<{ title: string; priority: 'p1' | 'p2' | 'p3' }>,
  doneTitles: Set<string>,
  blockedTitles: Set<string>,
  shrink: (title: string) => string,
): ReplanResult {
  const rank: Record<string, number> = { p1: 0, p2: 1, p3: 2 };
  const cleared: string[] = [];
  const shrunk: ReplanResult['shrunk'] = [];
  const open: Array<{ title: string; priority: 'p1' | 'p2' | 'p3' }> = [];
  for (const t of tasks) {
    if (doneTitles.has(t.title)) {
      cleared.push(t.title);
      continue;
    }
    if (blockedTitles.has(t.title)) {
      shrunk.push({ from: t.title, to: shrink(t.title) });
      continue;
    }
    open.push(t);
  }
  open.sort((a, b) => rank[a.priority] - rank[b.priority]);
  return { shrunk, nextFocus: open.map((t) => t.title), cleared };
}
