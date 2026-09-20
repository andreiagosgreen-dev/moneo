/**
 * The "20 hours" framework as a practical motivator (Faza 6): ~20 hours
 * of deliberate practice can take a beginner to basic autonomy in a
 * narrowly-defined skill. Framed honestly — mastery takes far more and
 * depends on the domain. Never invent resources, never certify progress
 * without proof: read ≠ practiced ≠ demonstrable.
 */

export type PracticeResult = 'read' | 'practiced' | 'demonstrated';

export interface SprintInput {
  skill: string;
  hoursPerWeek: number;
}

export interface SprintCheckpoint {
  atHours: 5 | 10 | 15 | 20;
  /** Frame id — UI translates. */
  proofFrame: string;
}

export interface BuiltSprint {
  skill: string;
  /** Narrow, observable outcome frame id + vars. */
  outcomeFrame: string;
  outcomeVars: { skill: string };
  /** 3–5 high-leverage sub-skills (80/20), as frame ids. */
  subskillFrames: string[];
  totalPomodoros: 40;
  checkpoints: SprintCheckpoint[];
  weeks: number;
}

export interface PracticeEntry {
  what: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  result: PracticeResult;
  next: string;
  at: number;
}

const SUBSKILL_PACKS: Array<{ re: RegExp; frames: string[] }> = [
  {
    re: /react|frontend|front-end|code|cod|program|python|javascript|js\b|typescript|web|developer|dezvolt/i,
    frames: [
      'ai.tpl.sub.readDocs',
      'ai.tpl.sub.coreDrill',
      'ai.tpl.sub.feedback',
      'ai.tpl.sub.realProject',
      'ai.tpl.sub.polishDemo',
    ],
  },
  {
    re: /english|englez|spanish|french|german|language|limb|limbă|jazyk|sprache|speaking|vorbit|разговор|англий|україн/i,
    frames: [
      'ai.tpl.sub.coreVocab',
      'ai.tpl.sub.shadow',
      'ai.tpl.sub.shortConv',
      'ai.tpl.sub.feedbackLoop',
      'ai.tpl.sub.realSim',
    ],
  },
  {
    re: /design|ux|ui\b|figma|draw|desen|art|photo|foto|рис|дизайн/i,
    frames: [
      'ai.tpl.sub.hierarchy',
      'ai.tpl.sub.spacing',
      'ai.tpl.sub.color',
      'ai.tpl.sub.controlledCopy',
      'ai.tpl.sub.ownProject',
    ],
  },
];

const GENERIC_SUBSKILLS = [
  'ai.tpl.sub.foundations',
  'ai.tpl.sub.coreDrill',
  'ai.tpl.sub.feedbackLoop',
  'ai.tpl.sub.realProject',
];

const CHECKPOINT_PROOFS: SprintCheckpoint['proofFrame'][] = [
  'ai.tpl.proof.exercise',
  'ai.tpl.proof.miniProject',
  'ai.tpl.proof.demo',
  'ai.tpl.proof.quiz',
];

/** 20h = 40 × 25-min Pomodoros (or configured sessions — kept standard). */
export function buildSprint(input: SprintInput): BuiltSprint {
  const skill = input.skill.trim().replace(/\s+/g, ' ');
  const hoursPerWeek = Math.min(40, Math.max(1, Math.round(input.hoursPerWeek)));
  const pack = SUBSKILL_PACKS.find((p) => p.re.test(skill));
  const subskillFrames = (pack ? pack.frames : GENERIC_SUBSKILLS).slice(0, 5);
  return {
    skill,
    outcomeFrame: 'ai.tpl.sprintOutcome',
    outcomeVars: { skill },
    subskillFrames,
    totalPomodoros: 40,
    checkpoints: ([5, 10, 15, 20] as const).map((atHours, i) => ({
      atHours,
      proofFrame: CHECKPOINT_PROOFS[i],
    })),
    weeks: Math.max(1, Math.ceil(20 / hoursPerWeek)),
  };
}

/** Validate a practice log entry; null when junk. Evidence over hours. */
export function logPractice(entry: {
  what: unknown;
  difficulty: unknown;
  result: unknown;
  next: unknown;
}): PracticeEntry | null {
  const what = typeof entry.what === 'string' ? entry.what.trim().slice(0, 140) : '';
  const next = typeof entry.next === 'string' ? entry.next.trim().slice(0, 140) : '';
  const difficulty =
    typeof entry.difficulty === 'number' &&
    Number.isInteger(entry.difficulty) &&
    entry.difficulty >= 1 &&
    entry.difficulty <= 5
      ? (entry.difficulty as PracticeEntry['difficulty'])
      : null;
  const result: PracticeResult | null =
    entry.result === 'read' || entry.result === 'practiced' || entry.result === 'demonstrated'
      ? entry.result
      : null;
  if (!what || difficulty === null || result === null || !next) return null;
  return { what, difficulty, result, next, at: Date.now() };
}
