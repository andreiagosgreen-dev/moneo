import { dayKeyInTz, currentStreakInTz } from './timezone';
import type { Session } from './store';
import type { FocusArea } from './focusAreas';
import type { Project } from './projects';
import { goalProgress, type Goal } from './goals';
import type { Task } from './tasks';
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as readInsights, safeWrite as writeInsights } from './storage/storageAdapter';
import { createI18n, type I18n } from './i18n';
import { dayCapacity } from './ritual';
import { weekdayOfKey } from './timeBlocks';
import { planForDay, type IvyPlan } from './ivyLee';

/** Default English translator — keeps rules usable without a provider. */
const EN_I18N = createI18n('en');

/**
 * Moneo Insights — a deterministic, rule-based "AI assistant".
 *
 * Every insight is a pure function of history + projects + tasks. No API
 * calls, no stored counters — identical data → identical insight. Gated
 * by tier: `core` insights are always free; `pro` insights unlock with
 * a Moneo Pro subscription.
 */

export type InsightTier = 'core' | 'pro';

export type InsightKind =
  | 'pareto'
  | 'streak'
  | 'bestWindow'
  | 'neglect'
  | 'deadline'
  | 'nextTask'
  | 'consistency'
  | 'milestone'
  | 'pace'
  | 'mapNeglect'
  | 'planOverload'
  | 'stalledProject';

export type InsightConfidence = 'high' | 'medium' | 'low';

/**
 * The single explicit action an insight offers (Faza 7). The UI executes
 * it only on tap — approval is the tap itself. 'none' keeps purely
 * informational signals honest about having no action.
 */
export type InsightCta =
  | { type: 'none' }
  | { type: 'block-tomorrow'; minutes: number; startMin: number; label: string }
  | { type: 'step-today'; text: string; label: string }
  | { type: 'add-to-plan'; title: string; estimateMin?: number; label: string }
  | {
      type: 'move-to-tomorrow';
      tasks: Array<{ id: string; text: string; estimateMin?: number }>;
      label: string;
    }
  | { type: 'prioritize-task'; taskId: string; title: string; label: string };

export interface Insight {
  id: string;
  tier: InsightTier;
  kind: InsightKind;
  title: string;
  body: string;
  /** Why this is shown now. */
  reason: string;
  /** The data behind it (counts, windows). */
  dataUsed: string;
  confidence: InsightConfidence;
  cta: InsightCta;
}

/** Weekly attention per life area, for the balance rule. */
export interface MapAttention {
  areaId: string;
  name: string;
  minutes: number;
  importance: number;
}

export const CORE_INSIGHT_LIMIT = 2;

/** Dismissed insight ids, persisted so feedback survives reloads (Roadmap 3.5). */
export function loadDismissedInsights(): string[] {
  const stored = readInsights<string[]>(STORAGE_KEYS.insightsDismissed);
  if (!Array.isArray(stored)) return [];
  return Array.from(new Set(stored.filter((id) => typeof id === 'string'))).slice(-100);
}

export function saveDismissedInsights(ids: string[]): boolean {
  const clean = Array.from(new Set(ids.filter((id) => typeof id === 'string'))).slice(-100);
  return writeInsights(STORAGE_KEYS.insightsDismissed, clean);
}

/** Which insights are visible without a Pro subscription. */
export function visibleInsights(insights: Insight[], isPro: boolean): Insight[] {
  if (isPro) return insights;
  return insights
    .filter((i) => i.tier === 'core')
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, CORE_INSIGHT_LIMIT);
}

/* ---------- pure rule helpers ---------- */

const HOUR = 3600_000;

function hourInTz(ts: number, timezone: string): number {
  const tz = timezone;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date(ts));
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
}

function minutesInLast(history: Session[], days: number, _tz: string): number {
  const threshold = Date.now() - days * 24 * HOUR;
  return history.filter((s) => s.at >= threshold).reduce((sum, s) => sum + s.min, 0);
}

function minutesForProjectInLast(
  history: Session[],
  projectId: string,
  days: number,
  _tz: string,
): number {
  const threshold = Date.now() - days * 24 * HOUR;
  return history
    .filter((s) => s.projectId === projectId && s.at >= threshold)
    .reduce((sum, s) => sum + s.min, 0);
}

function minutesForTask(history: Session[], taskId: string): number {
  return history.filter((s) => s.taskId === taskId).reduce((sum, s) => sum + s.min, 0);
}

/* ---------- individual rules ---------- */

/** 80/20 Pareto: the smallest project subset covering ≥80% of focus. */
function paretoRule(history: Session[], projects: Project[], i18n: I18n): Insight | null {
  const slices = new Map<string, number>();
  for (const s of history) {
    const pid = s.projectId ?? '';
    slices.set(pid, (slices.get(pid) ?? 0) + s.min);
  }
  const total = [...slices.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  const ranked = [...slices.entries()].sort((a, b) => b[1] - a[1]);
  const limit = Math.max(1, Math.round(total * 0.8));
  let acc = 0;
  const topIds: string[] = [];
  for (const [id, min] of ranked) {
    topIds.push(id);
    acc += min;
    if (acc >= limit) break;
  }

  const names = topIds.map((id) => {
    const proj = projects.find((p) => p.id === id);
    return proj?.name ?? (id === '' ? i18n.t('ins.pareto.unassigned') : i18n.t('ins.pareto.past'));
  });
  const pct = Math.round((acc / total) * 100);
  const count = names.length;

  return {
    id: 'pareto',
    tier: 'core',
    kind: 'pareto',
    title: i18n.t(count === 1 ? 'ins.pareto.one' : 'ins.pareto.many'),
    body: i18n.tp('ins.pareto.body', count, { pct, names: listNames(names, i18n) }),
    reason: i18n.t('ins.pareto.reason'),
    dataUsed: i18n.t('ins.pareto.data', { n: history.length }),
    confidence: history.length >= 10 ? 'high' : 'medium',
    cta: { type: 'none' },
  };
}

function listNames(names: string[], i18n: I18n): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return i18n.t('ins.list.two', { a: names[0], b: names[1] });
  return i18n.t('ins.list.many', {
    head: names.slice(0, -1).join(', '),
    last: names[names.length - 1],
  });
}

/** Streak: momentum either to protect or to start. */
function streakRule(history: Session[], timezone: string, i18n: I18n): Insight {
  const streak = currentStreakInTz(history, timezone);
  const base = {
    id: 'streak',
    tier: 'core' as const,
    kind: 'streak' as const,
    reason: i18n.t('ins.streak.reason'),
    dataUsed: i18n.t('ins.streak.data', { n: history.length }),
    confidence: 'high' as const,
    cta: { type: 'none' } as InsightCta,
  };
  if (streak === 0) {
    return { ...base, title: i18n.t('ins.streak.start'), body: i18n.t('ins.streak.startBody') };
  }
  if (streak === 1) {
    return {
      ...base,
      title: i18n.t('ins.streak.building'),
      body: i18n.t('ins.streak.buildingBody'),
    };
  }
  return {
    ...base,
    title: i18n.t('ins.streak.days', { n: streak }),
    body: i18n.tp('ins.streak.daysBody', streak, { n: streak }),
  };
}

/** Best focus window: the 2-hour span where focus minutes peak. */
function bestWindowRule(history: Session[], timezone: string, i18n: I18n): Insight | null {
  if (history.length === 0) return null;
  // hours 0..23 → minutes focused
  const slots = new Array<number>(24).fill(0);
  for (const s of history) {
    const hour = hourInTz(s.at, timezone);
    slots[hour] = (slots[hour] ?? 0) + s.min;
  }
  let bestStart = 0;
  let bestSum = 0;
  for (let start = 0; start < 24; start++) {
    const sum = slots[start % 24] + slots[(start + 1) % 24];
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = start;
    }
  }
  if (bestSum <= 0) return null;
  const fmt = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  const end = (bestStart + 2) % 24;
  const blockMin = 50;
  return {
    id: 'bestWindow',
    tier: 'pro',
    kind: 'bestWindow',
    title: i18n.t('ins.window.title'),
    body: i18n.t('ins.window.body', { a: fmt(bestStart), b: fmt(end) }),
    reason: i18n.t('ins.window.reason', { a: fmt(bestStart), b: fmt(end) }),
    dataUsed: i18n.t('ins.window.data', { n: history.length }),
    confidence: bestSum >= 300 ? 'high' : bestSum >= 120 ? 'medium' : 'low',
    cta: {
      type: 'block-tomorrow',
      minutes: blockMin,
      startMin: bestStart * 60,
      label: i18n.t('ins.window.cta', { n: blockMin }),
    },
  };
}

/** Neglect: a project with meaningful history recently went quiet. */
function neglectRule(
  history: Session[],
  projects: Project[],
  timezone: string,
  i18n: I18n,
): Insight | null {
  const quiet = projects.filter((p) => {
    if (p.archived) return false;
    const recent30 = minutesForProjectInLast(history, p.id, 30, timezone);
    const recent3 = minutesForProjectInLast(history, p.id, 3, timezone);
    return recent30 >= 15 && recent3 === 0;
  });
  if (quiet.length === 0) return null;
  quiet.sort(
    (a, b) =>
      minutesForProjectInLast(history, b.id, 30, timezone) -
      minutesForProjectInLast(history, a.id, 30, timezone),
  );
  const p = quiet[0];
  const share = Math.round(
    (minutesForProjectInLast(history, p.id, 30, timezone) /
      Math.max(1, minutesInLast(history, 30, timezone))) *
      100,
  );
  return {
    id: 'neglect',
    tier: 'pro',
    kind: 'neglect',
    title: i18n.t('ins.neglect.title'),
    body: i18n.t('ins.neglect.body', { name: p.name, share }),
    reason: i18n.t('ins.neglect.reason', { name: p.name }),
    dataUsed: i18n.t('ins.neglect.data'),
    confidence: 'medium',
    cta: {
      type: 'step-today',
      text: i18n.t('ins.neglect.step', { name: p.name }),
      label: i18n.t('ins.neglect.cta'),
    },
  };
}

/** Deadline: an active project is due within 7 days. */
function deadlineRule(
  history: Session[],
  projects: Project[],
  timezone: string,
  i18n: I18n,
): Insight | null {
  const now = Date.now();
  const due = projects
    .filter((p) => !p.archived && p.deadline && p.deadline > now)
    .map((p) => ({
      project: p,
      daysLeft: Math.ceil((p.deadline! - now) / (24 * HOUR)),
    }))
    .filter((d) => d.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  if (due.length === 0) return null;
  const first = due[0];
  const invested = minutesForProjectInLast(history, first.project.id, 60, timezone);
  return {
    id: 'deadline',
    tier: 'pro',
    kind: 'deadline',
    title: i18n.t('ins.deadline.title', { name: first.project.name, n: first.daysLeft }),
    body:
      invested === 0
        ? i18n.t('ins.deadline.fresh')
        : i18n.t('ins.deadline.invested', { dur: i18n.fmtDur(invested) }),
    reason: i18n.t('ins.deadline.reason', { name: first.project.name, n: first.daysLeft }),
    dataUsed: i18n.t('ins.deadline.data'),
    confidence: 'high',
    cta: {
      type: 'step-today',
      text: i18n.t('ins.deadline.step', { name: first.project.name }),
      label: i18n.t('ins.deadline.cta'),
    },
  };
}

/** Next best task: open tasks, priority first, then deadline, then neglect. */
function nextTaskRule(
  history: Session[],
  projects: Project[],
  tasks: Array<{
    id: string;
    projectId: string;
    title: string;
    status: string;
    priority: string;
    estimateMin?: number;
  }>,
  i18n: I18n,
): Insight | null {
  const open = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress' || t.status === 'blocked',
  );
  if (open.length === 0) return null;
  const priorityRank: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const ranked = open
    .map((t) => ({
      task: t,
      lastMin: minutesForTask(history, t.id),
      deadline: projectById.get(t.projectId)?.deadline ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => {
      const pa = priorityRank[a.task.priority] ?? 3;
      const pb = priorityRank[b.task.priority] ?? 3;
      return pa - pb || a.deadline - b.deadline || a.lastMin - b.lastMin;
    });
  const best = ranked[0];
  const proj = projectById.get(best.task.projectId);
  const projName = proj ? i18n.t('ins.next.inProject', { name: proj.name }) : '';
  return {
    id: 'nextTask',
    tier: 'pro',
    kind: 'nextTask',
    title: i18n.t('ins.next.title'),
    body: i18n.t('ins.next.body', {
      title: best.task.title,
      proj: projName,
      pri: best.task.priority.toUpperCase(),
      tail: i18n.t(best.lastMin > 0 ? 'ins.next.invested' : 'ins.next.fresh'),
    }),
    reason: i18n.t('ins.next.reason', {
      pri: best.task.priority.toUpperCase(),
      n: open.length,
    }),
    dataUsed: i18n.t('ins.next.data', { n: open.length }),
    confidence: open.length >= 5 ? 'medium' : 'low',
    cta: {
      type: 'add-to-plan',
      title: best.task.title,
      ...(typeof best.task.estimateMin === 'number' ? { estimateMin: best.task.estimateMin } : {}),
      label: i18n.t('ins.next.cta'),
    },
  };
}

/** Milestone smashed: celebrate fully-completed goals (Roadmap 4.4). */
function milestoneRule(goals: Goal[] | undefined, tasks: Task[], i18n: I18n): Insight | null {
  if (!goals || goals.length === 0) return null;
  const done = goals.filter((g) => !g.archived && goalProgress(goals, tasks, g.id) >= 100);
  if (done.length === 0) return null;
  const names = done
    .slice(0, 2)
    .map((g) => i18n.t('ins.mile.quoted', { title: g.title }))
    .join(i18n.t('ins.list.and'));
  return {
    id: 'milestone',
    tier: 'core',
    kind: 'milestone',
    title: i18n.t('ins.mile.title'),
    body:
      done.length > 2
        ? i18n.t('ins.mile.more', { names, n: done.length - 2 })
        : i18n.t('ins.mile.plain', { names }),
    reason: i18n.t('ins.mile.reason', { n: done.length }),
    dataUsed: i18n.t('ins.mile.data', { n: goals.filter((g) => !g.archived).length }),
    confidence: 'high',
    cta: { type: 'none' },
  };
}

/**
 * Adaptive pace: trailing week vs the week before (Roadmap 4.4 adaptive
 * planning). Needs both windows non-empty and a ≥40% swing. Pro tier.
 */
function paceRule(history: Session[], i18n: I18n): Insight | null {
  const now = Date.now();
  const recent = history
    .filter((s) => s.at >= now - 7 * 24 * HOUR)
    .reduce((sum, s) => sum + s.min, 0);
  const prior = history
    .filter((s) => s.at >= now - 14 * 24 * HOUR && s.at < now - 7 * 24 * HOUR)
    .reduce((sum, s) => sum + s.min, 0);
  if (recent <= 0 || prior <= 0) return null;
  const delta = (recent - prior) / prior;
  const base = {
    id: 'pace',
    tier: 'pro' as const,
    kind: 'pace' as const,
    reason: i18n.t('ins.pace.reason'),
    dataUsed: i18n.t('ins.pace.data'),
    confidence: 'medium' as const,
    cta: { type: 'none' } as InsightCta,
  };
  if (delta >= 0.4) {
    return {
      ...base,
      title: i18n.t('ins.pace.up'),
      body: i18n.t('ins.pace.upBody', { recent: i18n.fmtDur(recent), prior: i18n.fmtDur(prior) }),
    };
  }
  if (delta <= -0.4) {
    return {
      ...base,
      title: i18n.t('ins.pace.down'),
      body: i18n.t('ins.pace.downBody', { recent: i18n.fmtDur(recent), prior: i18n.fmtDur(prior) }),
    };
  }
  return null;
}

/* ---------- Faza 7: action rules ---------- */

/**
 * Balance check: the best-fed area vs a starved one. Fires when one area
 * got real attention this week while another got nothing.
 */
function mapNeglectRule(attention: MapAttention[] | undefined, i18n: I18n): Insight | null {
  const rows = Array.isArray(attention) ? attention : [];
  if (rows.length < 2) return null;
  const fed = [...rows].sort((a, b) => b.minutes - a.minutes)[0];
  if (!fed || fed.minutes < 60) return null;
  const starved = rows.filter((r) => r.minutes <= 0).sort((a, b) => b.importance - a.importance)[0];
  if (!starved) return null;
  return {
    id: 'mapNeglect',
    tier: 'pro',
    kind: 'mapNeglect',
    title: i18n.t('ins.map.title', { low: starved.name }),
    body: i18n.t('ins.map.body', {
      top: fed.name,
      dur: i18n.fmtDur(fed.minutes),
      low: starved.name,
    }),
    reason: i18n.t('ins.map.reason', { low: starved.name }),
    dataUsed: i18n.t('ins.map.data'),
    confidence: fed.minutes >= 120 ? 'high' : 'medium',
    cta: {
      type: 'step-today',
      text: i18n.t('ins.map.step', { name: starved.name }),
      label: i18n.t('ins.map.cta'),
    },
  };
}

/**
 * Overloaded day: today's estimates exceed real block capacity.
 * Picks the smallest set of open plan tasks covering the excess.
 */
function planOverloadRule(
  plans: IvyPlan[] | undefined,
  blocks: import('./timeBlocks').TimeBlock[] | undefined,
  timezone: string,
  i18n: I18n,
): Insight | null {
  if (!plans || !blocks) return null;
  const now = Date.now();
  const todayKey = dayKeyInTz(now, timezone);
  const plan = planForDay(plans, todayKey);
  if (!plan) return null;
  const open = plan.tasks.filter((t) => !t.done && t.text.trim());
  if (open.length === 0) return null;
  const planned = open.reduce((s, t) => s + (t.estimateMin ?? POMODORO_FALLBACK_MIN), 0);
  const capacity = dayCapacity(blocks, weekdayOfKey(todayKey));
  const excess = planned - capacity;
  if (excess < 30) return null;

  const bySize = [...open].sort(
    (a, b) => (b.estimateMin ?? POMODORO_FALLBACK_MIN) - (a.estimateMin ?? POMODORO_FALLBACK_MIN),
  );
  const move: Array<{ id: string; text: string; estimateMin?: number }> = [];
  let covered = 0;
  for (const t of bySize) {
    if (covered >= excess || move.length >= 3) break;
    move.push({
      id: t.id,
      text: t.text,
      ...(typeof t.estimateMin === 'number' ? { estimateMin: t.estimateMin } : {}),
    });
    covered += t.estimateMin ?? POMODORO_FALLBACK_MIN;
  }
  if (move.length === 0) return null;
  const allEstimated = open.every((t) => typeof t.estimateMin === 'number');
  return {
    id: 'planOverload',
    tier: 'pro',
    kind: 'planOverload',
    title: i18n.t('ins.overload.title'),
    body: i18n.t('ins.overload.body', {
      excess: i18n.fmtDur(excess),
      planned: i18n.fmtDur(planned),
      cap: i18n.fmtDur(capacity),
    }),
    reason: i18n.t('ins.overload.reason', { n: move.length }),
    dataUsed: i18n.t('ins.overload.data', { n: open.length }),
    confidence: allEstimated ? 'high' : 'medium',
    cta: {
      type: 'move-to-tomorrow',
      tasks: move,
      label: i18n.tp('ins.overload.cta', move.length),
    },
  };
}

const POMODORO_FALLBACK_MIN = 25;

/**
 * Stalled project: real focus this week, no finished task, linked goal
 * under 100%. The next action is explicit: make the top open task P0.
 */
function stalledProjectRule(
  history: Session[],
  projects: Project[],
  tasks: Task[],
  goals: Goal[] | undefined,
  i18n: I18n,
): Insight | null {
  if (!goals || goals.length === 0) return null;
  const now = Date.now();
  const weekAgo = now - 7 * 24 * HOUR;
  const openGoals = goals.filter((g) => !g.archived);
  const candidates: Array<{
    project: Project;
    goal: Goal;
    minutes: number;
    task: Task;
  }> = [];
  for (const p of projects) {
    if (p.archived) continue;
    const minutes = history
      .filter((s) => s.projectId === p.id && s.at >= weekAgo)
      .reduce((sum, s) => sum + s.min, 0);
    if (minutes < 60) continue;
    const finished = tasks.some(
      (t) => t.projectId === p.id && t.status === 'completed' && t.updatedAt >= weekAgo,
    );
    if (finished) continue;
    const linked = openGoals.filter(
      (g) => g.projectId === p.id && goalProgress(goals, tasks, g.id) < 100,
    );
    if (linked.length === 0) continue;
    const rank: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };
    const openTasks = tasks
      .filter((t) => t.projectId === p.id && t.status !== 'completed')
      .sort(
        (a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3) || a.createdAt - b.createdAt,
      );
    if (openTasks.length === 0) continue;
    candidates.push({ project: p, goal: linked[0], minutes, task: openTasks[0] });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.minutes - a.minutes);
  const top = candidates[0];
  return {
    id: 'stalledProject',
    tier: 'pro',
    kind: 'stalledProject',
    title: i18n.t('ins.stalled.title', { project: top.project.name }),
    body: i18n.t('ins.stalled.body', {
      project: top.project.name,
      dur: i18n.fmtDur(top.minutes),
      goal: top.goal.title,
      task: top.task.title,
    }),
    reason: i18n.t('ins.stalled.reason', { goal: top.goal.title }),
    dataUsed: i18n.t('ins.stalled.data'),
    confidence: top.minutes >= 180 ? 'high' : 'medium',
    cta: {
      type: 'prioritize-task',
      taskId: top.task.id,
      title: top.task.title,
      label: i18n.t('ins.stalled.cta'),
    },
  };
}

/* ---------- public API ---------- */

export interface InsightsInput {
  history: Session[];
  projects: Project[];
  areas: FocusArea[];
  tasks: Array<{
    id: string;
    projectId: string;
    title: string;
    status: string;
    priority: string;
    estimateMin?: number;
  }>;
  timezone: string;
  /** Optional full goals for the milestone rule (omitted = rule sleeps). */
  goals?: Goal[];
  /** Full tasks for goal-progress rollup in the milestone rule. */
  fullTasks?: Task[];
  /** Today's plans + blocks for the overload rule (omitted = sleeps). */
  plans?: IvyPlan[];
  blocks?: import('./timeBlocks').TimeBlock[];
  /** Weekly life-area attention for the balance rule (omitted = sleeps). */
  mapAttention?: MapAttention[];
}

/**
 * Generate all candidate insights in display order. Free users see a
 * limited core set (see visibleInsights). Pass the UI translator for
 * localized strings; English by default (tests included).
 */
export function getInsights(input: InsightsInput, i18n: I18n = EN_I18N): Insight[] {
  const { history, projects, tasks, timezone } = input;
  const list: Insight[] = [];

  const stre = streakRule(history, timezone, i18n);
  if (stre) list.push(stre);

  const par = paretoRule(history, projects, i18n);
  if (par) list.push(par);

  const win = bestWindowRule(history, timezone, i18n);
  if (win) list.push(win);

  const neg = neglectRule(history, projects, timezone, i18n);
  if (neg) list.push(neg);

  const deadl = deadlineRule(history, projects, timezone, i18n);
  if (deadl) list.push(deadl);

  const next = nextTaskRule(history, projects, tasks, i18n);
  if (next) list.push(next);

  const mile = milestoneRule(input.goals, input.fullTasks ?? [], i18n);
  if (mile) list.push(mile);

  const pace = paceRule(history, i18n);
  if (pace) list.push(pace);

  const map = mapNeglectRule(input.mapAttention, i18n);
  if (map) list.push(map);

  const over = planOverloadRule(input.plans, input.blocks, timezone, i18n);
  if (over) list.push(over);

  const stall = stalledProjectRule(history, projects, input.fullTasks ?? [], input.goals, i18n);
  if (stall) list.push(stall);

  // consistency: today's progress vs the 7-day average
  const recent7 = history.filter((s) => s.at >= Date.now() - 7 * 24 * HOUR);
  const todayKey = dayKeyInTz(Date.now(), timezone);
  const todaySessions = history.filter((s) => dayKeyInTz(s.at, timezone) === todayKey).length;
  const avg7 = history.length > 0 ? recent7.length / 7 : 0;
  if (avg7 > 0 && todaySessions < Math.max(1, Math.floor(avg7 * 0.5))) {
    list.push({
      id: 'consistency',
      tier: 'pro',
      kind: 'consistency',
      title: i18n.t('ins.slow.title'),
      body: i18n.t('ins.slow.body', { avg: avg7.toFixed(1), n: todaySessions }),
      reason: i18n.t('ins.slow.reason'),
      dataUsed: i18n.t('ins.slow.data', { n: recent7.length }),
      confidence: 'low',
      cta: { type: 'none' },
    });
  }

  return list;
}
