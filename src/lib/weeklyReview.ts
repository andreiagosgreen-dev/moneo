/* Weekly narrative summary (Faza 22) — a few personal, rule-based lines,
 * not charts: what went best, what's stagnating, one decision question.
 * Same "pure text generator over i18n keys" pattern as okrReview() in
 * okrs.ts — no LLM call, deterministic, testable.
 */
import { createI18n, type I18n } from './i18n';
import { localDayKey } from './projects';
import type { Project } from './projects';
import type { Task } from './tasks';
import type { Session } from './store';

const EN_I18N = createI18n('en');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** A task untouched this long (and not overdue) counts as stagnating. */
const STALE_MS = 14 * 24 * 60 * 60 * 1000;

export interface WeeklyReviewInput {
  history: Session[];
  tasks: Task[];
  projects: Project[];
}

export interface StagnatingTask {
  task: Task;
  /** Days since the task last changed, or days overdue — whichever applies. */
  days: number;
  overdue: boolean;
}

/** Minutes focused per project over the trailing week, most-focused first. */
export function weekMinutesByProject(
  history: Session[],
  projects: Project[],
  now: number = Date.now(),
): Array<{ project: Project; minutes: number }> {
  const start = now - WEEK_MS;
  const byProject = new Map<string, number>();
  for (const s of history) {
    if (typeof s.at !== 'number' || s.at < start || s.at > now) continue;
    if (!s.projectId) continue;
    byProject.set(s.projectId, (byProject.get(s.projectId) ?? 0) + (s.min || 0));
  }
  return projects
    .filter((p) => !p.archived && byProject.has(p.id))
    .map((project) => ({ project, minutes: byProject.get(project.id) as number }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Open tasks that are overdue or untouched for STALE_MS+, worst first. */
export function stagnatingTasks(
  tasks: Task[],
  now: number = Date.now(),
): StagnatingTask[] {
  const out: StagnatingTask[] = [];
  for (const t of tasks) {
    if (t.status === 'completed') continue;
    if (typeof t.dueAt === 'number' && t.dueAt < now) {
      out.push({ task: t, days: Math.floor((now - t.dueAt) / 86400000), overdue: true });
      continue;
    }
    const idleMs = now - t.updatedAt;
    if (idleMs >= STALE_MS) {
      out.push({ task: t, days: Math.floor(idleMs / 86400000), overdue: false });
    }
  }
  return out.sort((a, b) => b.days - a.days);
}

/**
 * A few personal narrative lines for the trailing week. Never throws;
 * returns an empty-week message when there's nothing to report.
 */
export function weeklyNarrative(input: WeeklyReviewInput, i18n: I18n = EN_I18N): string {
  const { t } = i18n;
  const now = Date.now();
  const byProject = weekMinutesByProject(input.history, input.projects, now);
  const stale = stagnatingTasks(input.tasks, now);

  if (byProject.length === 0 && stale.length === 0) {
    return t('weeklyReview.empty');
  }

  const lines: string[] = [t('weeklyReview.header', { date: localDayKey(now) })];

  if (byProject.length > 0) {
    const best = byProject[0];
    lines.push(
      t('weeklyReview.bestLine', { name: best.project.name, minutes: String(best.minutes) }),
    );
  }

  if (stale.length > 0) {
    const names = stale.slice(0, 3).map((s) => s.task.title);
    lines.push(t('weeklyReview.stagnatingLine', { list: names.join(', ') }));
    const worst = stale[0];
    lines.push(
      t(
        worst.overdue ? 'weeklyReview.decisionOverdue' : 'weeklyReview.decisionStale',
        { title: worst.task.title, days: String(worst.days) },
      ),
    );
  } else {
    lines.push(t('weeklyReview.noStagnation'));
  }

  return lines.join('\n');
}
