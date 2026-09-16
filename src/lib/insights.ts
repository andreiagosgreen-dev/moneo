import { dayKeyInTz, currentStreakInTz } from './timezone';
import type { Session } from './store';
import type { FocusArea } from './focusAreas';
import type { Project } from './projects';

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
  'pareto' | 'streak' | 'bestWindow' | 'neglect' | 'deadline' | 'nextTask' | 'consistency';

export interface Insight {
  id: string;
  tier: InsightTier;
  kind: InsightKind;
  title: string;
  body: string;
}

export const CORE_INSIGHT_LIMIT = 2;

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
function paretoRule(history: Session[], projects: Project[]): Insight | null {
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
    return proj?.name ?? (id === '' ? 'Unassigned focus' : 'A past project');
  });
  const pct = Math.round((acc / total) * 100);
  const one = names.length === 1;

  return {
    id: 'pareto',
    tier: 'core',
    kind: 'pareto',
    title: one ? 'One thing drives your focus' : 'Your focus is concentrated',
    body: one
      ? `${fmtPct(pct)}% of your focus goes to ${names[0]}. Protect that time — it's paying off.`
      : `${fmtPct(pct)}% of your focus goes to just ${names.length} thing${names.length > 1 ? 's' : ''} (${listNames(names)}). The rest is splitting your attention.`,
  };
}

function listNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function fmtPct(n: number): string {
  return `${Math.max(0, Math.min(100, n))}%`;
}

/** Streak: momentum either to protect or to start. */
function streakRule(history: Session[], timezone: string): Insight {
  const streak = currentStreakInTz(history, timezone);
  if (streak === 0) {
    return {
      id: 'streak',
      tier: 'core',
      kind: 'streak',
      title: 'Start a streak today',
      body: 'One focus round now and your daily goal is back on track.',
    };
  }
  const label = streak === 1 ? 'session' : 'sessions';
  if (streak === 1) {
    return {
      id: 'streak',
      tier: 'core',
      kind: 'streak',
      title: 'Momentum is building',
      body: "Protect the streak — today's round keeps it alive.",
    };
  }
  return {
    id: 'streak',
    tier: 'core',
    kind: 'streak',
    title: `${streak}-day streak`,
    body: `You've focused ${streak} consecutive ${label}. One round today protects it.`,
  };
}

/** Best focus window: the 2-hour span where focus minutes peak. */
function bestWindowRule(history: Session[], timezone: string): Insight | null {
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
  return {
    id: 'bestWindow',
    tier: 'pro',
    kind: 'bestWindow',
    title: 'Your power hours',
    body: `You focus best between ${fmt(bestStart)} and ${fmt(end)}. Block that span for your hardest work.`,
  };
}

/** Neglect: a project with meaningful history recently went quiet. */
function neglectRule(history: Session[], projects: Project[], timezone: string): Insight | null {
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
    title: 'A project went quiet',
    body: `${p.name} drove ${share}% of your last 30 days of focus, but hasn't seen a round in 3+ days. Pick it back up before momentum fades.`,
  };
}

/** Deadline: an active project is due within 7 days. */
function deadlineRule(history: Session[], projects: Project[], timezone: string): Insight | null {
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
    title: `${first.project.name} is due in ${first.daysLeft}d`,
    body:
      invested === 0
        ? `No focus logged for it yet. Even one round today builds a cushion.`
        : `${fmtMinutes(invested)} focused in the last 60 days puts you ahead — keep the pace.`,
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
  }>,
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
  const projName = proj ? ` in ${proj.name}` : '';
  return {
    id: 'nextTask',
    tier: 'pro',
    kind: 'nextTask',
    title: 'What to work on next',
    body: `"${best.task.title}"${projName} — rated ${best.task.priority.toUpperCase()}.${
      best.lastMin > 0 ? ` It's also the task you've given the least focus lately.` : ' Start here.'
    }`,
  };
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
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
  }>;
  timezone: string;
}

/**
 * Generate all candidate insights in display order. Free users see a
 * limited core set (see visibleInsights).
 */
export function getInsights(input: InsightsInput): Insight[] {
  const { history, projects, tasks, timezone } = input;
  const list: Insight[] = [];

  const stre = streakRule(history, timezone);
  if (stre) list.push(stre);

  const par = paretoRule(history, projects);
  if (par) list.push(par);

  const win = bestWindowRule(history, timezone);
  if (win) list.push(win);

  const neg = neglectRule(history, projects, timezone);
  if (neg) list.push(neg);

  const deadl = deadlineRule(history, projects, timezone);
  if (deadl) list.push(deadl);

  const next = nextTaskRule(history, projects, tasks);
  if (next) list.push(next);

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
      title: 'A slow start today',
      body: `On average you log ${avg7.toFixed(1)} sessions/day — today has ${todaySessions} so far. One good round closes the gap.`,
    });
  }

  return list;
}
