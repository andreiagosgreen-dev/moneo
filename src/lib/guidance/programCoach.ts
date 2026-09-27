/**
 * Daily-spine program coach — pick one quiet guidance moment from day state.
 * No AI; pure priority rules for Today / Focus / Schedule.
 */

export type ProgramCoachScreen = 'today' | 'focus' | 'orar';

export type ProgramCoachKind =
  'aziEmpty' | 'aziOpen' | 'aziDone' | 'focusEmpty' | 'focusOpen' | 'orarEmpty' | 'orarHas';

export interface ProgramCoachInput {
  screen: ProgramCoachScreen;
  /** Tasks on today's Ivy plan. */
  planTaskCount: number;
  /** Unfinished tasks on today's plan. */
  planOpenCount: number;
  /** Any focus windows on the schedule. */
  hasBlocks: boolean;
}

/** How many example chips each kind shows (1-based i18n keys .ex1 …). */
export const COACH_EXAMPLE_COUNT: Record<ProgramCoachKind, number> = {
  aziEmpty: 3,
  aziOpen: 0,
  aziDone: 0,
  focusEmpty: 0,
  focusOpen: 2,
  orarEmpty: 2,
  orarHas: 0,
};

/** Optional primary CTA wired by the host screen. */
export type ProgramCoachCta = 'goWork' | 'writePlan' | 'shutdown';

export const COACH_CTA: Record<ProgramCoachKind, ProgramCoachCta | null> = {
  aziEmpty: null,
  aziOpen: 'goWork',
  aziDone: 'shutdown',
  focusEmpty: 'writePlan',
  focusOpen: null,
  orarEmpty: null,
  orarHas: null,
};

/**
 * One coaching moment for the active spine screen, or null when silent.
 */
export function pickProgramCoach(input: ProgramCoachInput): ProgramCoachKind | null {
  const tasks = Math.max(0, input.planTaskCount);
  const open = Math.max(0, input.planOpenCount);

  if (input.screen === 'today') {
    if (tasks === 0) return 'aziEmpty';
    if (open > 0) return 'aziOpen';
    return 'aziDone';
  }

  if (input.screen === 'focus') {
    if (tasks === 0) return 'focusEmpty';
    if (open > 0) return 'focusOpen';
    return null;
  }

  return input.hasBlocks ? 'orarHas' : 'orarEmpty';
}

const DISMISS_PREFIX = 'moneo.coach.dismissed.';

export function coachDismissKey(dayKey: string, kind: ProgramCoachKind): string {
  return `${DISMISS_PREFIX}${dayKey}.${kind}`;
}

export function isCoachDismissed(dayKey: string, kind: ProgramCoachKind): boolean {
  try {
    return localStorage.getItem(coachDismissKey(dayKey, kind)) === '1';
  } catch {
    return false;
  }
}

export function dismissCoach(dayKey: string, kind: ProgramCoachKind): void {
  try {
    localStorage.setItem(coachDismissKey(dayKey, kind), '1');
  } catch {
    /* ignore quota / private mode */
  }
}

/** Bring the guide back after dismiss. */
export function showCoachAgain(dayKey: string, kind: ProgramCoachKind): void {
  try {
    localStorage.removeItem(coachDismissKey(dayKey, kind));
  } catch {
    /* ignore */
  }
}
