/* Session → progress impact (progress companion).
 *
 * No storage change: a Session already carries projectId/taskId, and
 * projects/goals already expose completion math (projectCompletion,
 * goalProgress). This module derives one honest, quantifiable payoff per
 * completed session:
 *   - hours accumulated on the linked project (incl. this session),
 *   - percent of the task target (done/total, null when no tasks yet),
 *   - milestone flag when the project stands at 100%,
 *   - the first linked goal + its rollup percent,
 *   - week minutes on the project (last 7 days, incl. this session).
 * Pure functions; never throws.
 */
import type { Session } from './store';
import { getMinutesForProject, type Project } from './projects';
import { goalProgress, type Goal } from './goals';
import { projectCompletion, type Task } from './tasks';

export interface ProjectImpact {
  kind: 'project';
  projectId: string;
  projectName: string;
  projectColor: string;
  /** Minutes credited by the session that just completed. */
  sessionMin: number;
  /** All-time focus minutes on the project, including this session. */
  projectMinutes: number;
  doneTasks: number;
  totalTasks: number;
  /** Task-target percent, or null while the project has no tasks. */
  pct: number | null;
  /** True when the project stands at 100% of its task target. */
  reachedMilestone: boolean;
  goalId: string | null;
  goalTitle: string | null;
  /** Rollup percent of the linked goal, or null when no goal links here. */
  goalPct: number | null;
  /** Project minutes in the trailing 7 days, including this session. */
  weekMin: number;
}

export interface BareImpact {
  kind: 'none';
  sessionMin: number;
  weekMin: number;
}

export type SessionImpact = ProjectImpact | BareImpact;

export interface ImpactContext {
  projects: Project[];
  tasks: Task[];
  goals: Goal[];
  /** History INCLUDING the just-completed session (caller appends first). */
  history: Session[];
  now?: number;
}

const WEEK_MS = 7 * 24 * 3600_000;

function weekMinutes(history: Session[], projectId: string | null, now: number): number {
  const from = now - WEEK_MS;
  return history
    .filter(
      (s) =>
        s.at >= from && (projectId === null ? true : s.projectId === projectId),
    )
    .reduce((sum, s) => sum + s.min, 0);
}

/**
 * Quantify what one completed session moved. Sessions without a linked
 * (and existing) project yield a bare week-minutes impact — the UI then
 * shows generic credit instead of the meter.
 */
export function sessionProgressImpact(session: Session, ctx: ImpactContext): SessionImpact {
  const now = typeof ctx.now === 'number' && Number.isFinite(ctx.now) ? ctx.now : Date.now();
  const project = session.projectId
    ? (ctx.projects.find((p) => p.id === session.projectId) ?? null)
    : null;
  if (!project) {
    return { kind: 'none', sessionMin: session.min, weekMin: weekMinutes(ctx.history, null, now) };
  }
  const { done, total } = projectCompletion(ctx.tasks, project.id);
  const pct = total > 0 ? Math.round((done / total) * 100) : null;
  const goal =
    ctx.goals
      .filter((g) => !g.archived && g.projectId === project.id)
      .sort((a, b) => a.createdAt - b.createdAt)[0] ?? null;
  return {
    kind: 'project',
    projectId: project.id,
    projectName: project.name,
    projectColor: project.color,
    sessionMin: session.min,
    projectMinutes: getMinutesForProject(project.id, ctx.history),
    doneTasks: done,
    totalTasks: total,
    pct,
    reachedMilestone: pct === 100,
    goalId: goal ? goal.id : null,
    goalTitle: goal ? goal.title : null,
    goalPct: goal ? goalProgress(ctx.goals, ctx.tasks, goal.id) : null,
    weekMin: weekMinutes(ctx.history, project.id, now),
  };
}
