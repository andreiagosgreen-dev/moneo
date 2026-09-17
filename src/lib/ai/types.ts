/**
 * AI Planning Companion types (Faza 6).
 *
 * The companion is an execution assistant: big goal in, visual road map
 * out, then capacity-aware weekly drafts and Pomodoro estimates that learn
 * from real sessions. Everything here is provider-agnostic — the local
 * deterministic engine implements it today, a server-side model may
 * implement the same interface tomorrow (never in the browser).
 */

export type PathKind = 'learning' | 'launch' | 'general';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface PathInput {
  text: string;
  horizonMonths?: number;
  level?: SkillLevel;
  hoursPerWeek?: number;
}

export interface ResolvedPathInput {
  text: string;
  horizonMonths: number;
  level: SkillLevel;
  hoursPerWeek: number;
}

/** Ids of clarification questions — UI maps them to translated prompts. */
export type ClarifyId = 'horizon' | 'level' | 'hours';

export interface PathPhase {
  id: string;
  /** 1-based quarter index. */
  index: number;
  /** Inclusive month range, e.g. [1, 3]. */
  months: [number, number];
  outcome: string;
}

export interface PathMilestone {
  id: string;
  phaseId: string;
  title: string;
}

export interface PlannedTask {
  /** Stable draft id (replaced by the real id on approve). */
  draftId: string;
  milestoneId: string;
  title: string;
  pomodoros: number;
  priority: 'p1' | 'p2' | 'p3';
}

/** Structured assumption flags — UI renders them via translated keys. */
export type PathAssumption = 'trimmed-to-20' | 'tight-capacity';

export interface BuiltPath {
  goal: string;
  kind: PathKind;
  horizonMonths: number;
  level: SkillLevel;
  hoursPerWeek: number;
  phases: PathPhase[];
  milestones: PathMilestone[];
  tasks: PlannedTask[];
  totalPomodoros: number;
  fitsCapacity: boolean;
  assumptions: PathAssumption[];
}

export interface WeekDraftDay {
  dateKey: string;
  items: Array<{ title: string; pomodoros: number }>;
  minutes: number;
}

export interface WeekDraft {
  days: WeekDraftDay[];
  unscheduled: Array<{ title: string; pomodoros: number }>;
}

export type SessionFeedback = 'done' | 'continue' | 'blocked' | 'misestimated';

/** Coach lines are key+vars pairs — UI translates, tests stay language-free. */
export interface CoachLine {
  key: string;
  vars: Record<string, string | number>;
}

export interface PlanDraftSelection {
  createProject: boolean;
  draftIntoWeek: boolean;
}
