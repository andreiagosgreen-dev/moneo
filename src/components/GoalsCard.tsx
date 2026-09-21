import { useMemo, useState } from 'react';
import type { Goal, GoalLevel } from '../lib/goals';
import {
  GOAL_LEVELS,
  GOAL_LEVEL_LABELS,
  GOAL_LEVEL_SHORT_LABELS,
  FREE_GOALS_LIMIT,
  archivedGoals,
  canParent,
  childrenOf,
  createGoalObject,
  deleteGoal,
  goalBlockers,
  goalConflicts,
  goalProgress,
  rootGoals,
  setGoalBlockedBy,
  smartScore,
  suggestTasksForGoal,
  updateGoal,
} from '../lib/goals';
import type { LifeArea } from '../lib/lifeAreas';
import type { Project } from '../lib/projects';
import { activeProjects, createProjectObject } from '../lib/projects';
import type { Task } from '../lib/tasks';
import { createTaskObject, tasksForProject } from '../lib/tasks';
import { addTaskToDay, IVY_MAX_TASKS, IVY_FREE_MAX_TASKS, type IvyPlan } from '../lib/ivyLee';
import { dayKeyInTz } from '../lib/timezone';
import { useI18n } from '../lib/i18n/LocaleContext';
import { cleanupLinksFor, type EntityLink } from '../lib/entityLinks';
import type { Skill } from '../lib/skills';
import type { Objective } from '../lib/okrs';
import LinkedItems from './LinkedItems';

interface Props {
  goals: Goal[];
  goalsChange: (goals: Goal[]) => void;
  projects: Project[];
  projectsChange: (projects: Project[]) => void;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  ivyPlans: IvyPlan[];
  onIvyPlansChange: (plans: IvyPlan[]) => void;
  timezone: string;
  lifeAreas: LifeArea[];
  links: EntityLink[];
  onLinksChange: (links: EntityLink[]) => void;
  skills: Skill[];
  objectives: Objective[];
  isPro?: boolean;
}

// Re-export guard: parents listed for a level must be broader + active.
function validParents(goals: Goal[], level: GoalLevel, selfId?: string): Goal[] {
  return goals.filter((g) => !g.archived && g.id !== selfId && canParent(level, g));
}

export default function GoalsCard({
  goals,
  goalsChange,
  projects,
  projectsChange,
  tasks,
  onTasksChange,
  ivyPlans,
  onIvyPlansChange,
  timezone,
  lifeAreas,
  links,
  onLinksChange,
  skills,
  objectives,
  isPro = false,
}: Props) {
  const { t, tp } = useI18n();
  const [draft, setDraft] = useState('');
  const [draftLevel, setDraftLevel] = useState<GoalLevel>('project');
  const [draftParent, setDraftParent] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const liveProjects = useMemo(() => activeProjects(projects), [projects]);
  const roots = useMemo(() => rootGoals(goals), [goals]);
  const archived = useMemo(() => archivedGoals(goals), [goals]);
  const progressOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of goals) map.set(g.id, goalProgress(goals, tasks, g.id));
    return map;
  }, [goals, tasks]);

  const atCapacity = !isPro && goals.filter((g) => !g.archived).length >= FREE_GOALS_LIMIT;
  const conflicts = useMemo(() => goalConflicts(goals), [goals]);
  const maxIvy = isPro ? IVY_MAX_TASKS : IVY_FREE_MAX_TASKS;
  const todayKey = dayKeyInTz(Date.now(), timezone);

  const add = () => {
    if (!draft.trim() || atCapacity) return;
    const goal = createGoalObject(goals, draft, draftLevel, draftParent || undefined);
    if (!goal) return;
    goalsChange([...goals, goal]);
    setDraft('');
    setDraftParent('');
  };

  /** Ensures the goal has a real linked project, creating + persisting one
   *  (and linking it back onto the goal) if it doesn't yet. Returns the
   *  project to use, and the up-to-date goals/projects arrays. */
  const ensureGoalProject = (goal: Goal) => {
    const existing = goal.projectId && projects.find((p) => p.id === goal.projectId);
    if (existing) return { project: existing, goals, projects };
    const project = createProjectObject(goal.title.slice(0, 60), 'personal');
    const nextProjects = [...projects, project];
    const nextGoals = updateGoal(goals, goal.id, { projectId: project.id });
    projectsChange(nextProjects);
    goalsChange(nextGoals);
    return { project, goals: nextGoals, projects: nextProjects };
  };

  const generateTasks = (goal: Goal) => {
    const { project } = ensureGoalProject(goal);
    const titles = suggestTasksForGoal(goal.title);
    let next = tasks;
    for (const title of titles) {
      next = [...next, createTaskObject(project.id, title, 'p2')];
    }
    onTasksChange(next);
  };

  /** Sends a real task toward today's Ivy Lee plan (not a plain string) —
   *  reuses an existing incomplete task under the goal's project, or
   *  generates one first, so ticking it done in Today actually completes
   *  the task and rolls up into the goal's progress. */
  const sendToToday = (goal: Goal) => {
    const { project } = ensureGoalProject(goal);
    const openTask = tasksForProject(tasks, project.id).find((t) => t.status !== 'completed');
    const task =
      openTask ??
      createTaskObject(project.id, suggestTasksForGoal(goal.title)[0] ?? goal.title, 'p2');
    if (!openTask) onTasksChange([...tasks, task]);
    const { plans, added } = addTaskToDay(
      ivyPlans,
      todayKey,
      task.title,
      maxIvy,
      undefined,
      task.id,
    );
    if (added) onIvyPlansChange(plans);
  };

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('goals.ariaLabel')}>
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('goals.title')}
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {isPro
              ? t('goals.subtitlePro')
              : t('goals.subtitleFree', { n: String(FREE_GOALS_LIMIT) })}
          </p>
        </div>
      </header>

      {conflicts.length > 0 && (
        <p className="mt-3 rounded-lg bg-tomato/10 px-3 py-2 font-mono text-[11px] text-tomato ring-1 ring-inset ring-tomato/30">
          ⚠{' '}
          {tp('goals.conflictWarning', conflicts.length, {
            a: conflicts[0].a.title,
            b: conflicts[0].b.title,
            week: conflicts[0].week,
          })}
        </p>
      )}

      {roots.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] leading-relaxed text-faint">
          {t('goals.emptyLine1')}
          <br />
          {t('goals.emptyLine2')}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {roots.map((g) => (
            <GoalNode
              key={g.id}
              goal={g}
              goals={goals}
              goalsChange={goalsChange}
              liveProjects={liveProjects}
              lifeAreas={lifeAreas}
              tasks={tasks}
              progressOf={progressOf}
              ancestorIds={[]}
              onGenerate={generateTasks}
              onSendToToday={sendToToday}
              links={links}
              onLinksChange={onLinksChange}
              skills={skills}
              objectives={objectives}
            />
          ))}
        </ul>
      )}

      {!atCapacity ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              maxLength={80}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder={t('goals.form.placeholder')}
              className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
            <select
              value={draftLevel}
              onChange={(e) => {
                setDraftLevel(e.target.value as GoalLevel);
                setDraftParent('');
              }}
              className="h-9 shrink-0 rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              aria-label={t('goals.form.levelAria')}
            >
              {GOAL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(GOAL_LEVEL_LABELS[l])}
                </option>
              ))}
            </select>
            <button
              onClick={add}
              disabled={!draft.trim()}
              className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
              aria-label={t('goals.form.addAria')}
            >
              +
            </button>
          </div>
          {validParents(goals, draftLevel).length > 0 && (
            <select
              value={draftParent}
              onChange={(e) => setDraftParent(e.target.value)}
              className="h-9 w-full rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              aria-label={t('goals.form.parentAria')}
            >
              <option value="">{t('goals.form.noParent')}</option>
              {validParents(goals, draftLevel).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        !isPro && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
            <p className="text-[12px] leading-relaxed text-cream">
              {t('goals.capacityLine', { n: String(FREE_GOALS_LIMIT) })}
            </p>
            <p className="mt-1 font-mono text-[11px] text-faint">{t('goals.capacityUpgrade')}</p>
          </div>
        )
      )}

      {archived.length > 0 && (
        <div className="mt-3 border-t border-line/60 pt-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="press font-mono text-[11px] uppercase tracking-[0.18em] text-faint hover:text-sage"
          >
            {t('goals.archivedToggle', { n: String(archived.length) })} {showArchived ? '▴' : '▾'}
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-1">
              {archived.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 opacity-70"
                >
                  <span className="truncate text-[13px] text-cream/80">{g.title}</span>
                  <button
                    onClick={() => goalsChange(updateGoal(goals, g.id, { archived: false }))}
                    className="press shrink-0 font-mono text-[11px] text-faint hover:text-cream"
                  >
                    {t('goals.restore')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

interface NodeProps {
  goal: Goal;
  goals: Goal[];
  goalsChange: (goals: Goal[]) => void;
  liveProjects: Project[];
  lifeAreas: LifeArea[];
  tasks: Task[];
  progressOf: Map<string, number>;
  ancestorIds: string[];
  onGenerate: (goal: Goal) => void;
  onSendToToday: (goal: Goal) => void;
  links: EntityLink[];
  onLinksChange: (links: EntityLink[]) => void;
  skills: Skill[];
  objectives: Objective[];
}

function GoalNode({
  goal,
  goals,
  goalsChange,
  liveProjects,
  lifeAreas,
  tasks,
  progressOf,
  ancestorIds,
  onGenerate,
  onSendToToday,
  links,
  onLinksChange,
  skills,
  objectives,
}: NodeProps) {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);
  const pct = progressOf.get(goal.id) ?? 0;
  const kids = childrenOf(goals, goal.id).filter((k) => !ancestorIds.includes(k.id));
  const linked = goal.projectId ? liveProjects.find((p) => p.id === goal.projectId) : null;
  const smart = useMemo(() => smartScore(goal.title), [goal.title]);
  const blockers = useMemo(() => goalBlockers(goals, tasks, goal), [goals, tasks, goal]);
  const depCandidates = useMemo(
    () =>
      goals.filter(
        (g) => !g.archived && g.id !== goal.id && !(goal.blockedBy ?? []).includes(g.id),
      ),
    [goals, goal],
  );

  return (
    <li>
      <div className="rounded-xl bg-ink/40 px-3.5 py-3 ring-1 ring-inset ring-line">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-cream hover:text-accent"
          >
            {goal.title}
          </button>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-faint">
            {t(GOAL_LEVEL_SHORT_LABELS[goal.level])}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-sage">{pct}%</span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="press shrink-0 rounded p-1 font-mono text-[11px] text-faint hover:text-cream"
            aria-label={showDetails ? t('goals.node.hideDetails') : t('goals.node.showDetails')}
          >
            ⋯
          </button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--accent-deep), var(--accent))',
            }}
          />
        </div>
        {showDetails && (
          <div className="mt-2.5 space-y-2 border-t border-line/60 pt-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={goal.projectId ?? ''}
                onChange={(e) =>
                  goalsChange(updateGoal(goals, goal.id, { projectId: e.target.value || null }))
                }
                className="h-8 min-w-0 flex-1 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title={t('goals.node.linkedProjectTitle')}
              >
                <option value="">{t('goals.node.noProject')}</option>
                {liveProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={goal.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : ''}
                onChange={(e) =>
                  goalsChange(
                    updateGoal(goals, goal.id, {
                      targetDate: e.target.value
                        ? new Date(e.target.value + 'T12:00:00').getTime()
                        : null,
                    }),
                  )
                }
                className="h-8 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title={t('goals.node.targetDateTitle')}
              />
            </div>
            {!goal.projectId && kids.length === 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={goal.progress ?? 0}
                  onChange={(e) =>
                    goalsChange(updateGoal(goals, goal.id, { progress: Number(e.target.value) }))
                  }
                  className="h-1.5 flex-1 accent-[var(--accent)]"
                  aria-label={t('goals.node.manualProgressAria')}
                />
                <span className="font-mono text-[11px] text-sage">{goal.progress ?? 0}%</span>
              </div>
            )}
            {linked && (
              <p className="font-mono text-[10px] text-faint">
                {t('goals.node.progressMirrors', { name: linked.name })}
              </p>
            )}
            {goal.targetDate && (
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-faint">
                  {t('goals.node.capsuleNoteLabel')}
                </label>
                <textarea
                  value={goal.capsuleNote ?? ''}
                  onChange={(e) =>
                    goalsChange(
                      updateGoal(goals, goal.id, { capsuleNote: e.target.value || null }),
                    )
                  }
                  placeholder={t('goals.node.capsuleNotePlaceholder')}
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none rounded-lg bg-ink/60 px-2 py-1.5 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                  title={t('goals.node.capsuleNoteTitle')}
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={goal.lifeAreaId ?? ''}
                onChange={(e) =>
                  goalsChange(updateGoal(goals, goal.id, { lifeAreaId: e.target.value || null }))
                }
                className="h-8 min-w-0 flex-1 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title={t('goals.node.lifeAreaTitle')}
              >
                <option value="">{t('goals.node.noLifeArea')}</option>
                {lifeAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <span
                className="shrink-0 font-mono text-[10px] text-sage"
                title={
                  smart.tips.length > 0 ? smart.tips.join(' ') : t('goals.node.smartTipsDefault')
                }
              >
                {t('goals.node.smartScore', { score: String(smart.score) })}
              </span>
            </div>
            {blockers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {blockers.map((b) => (
                  <span
                    key={b.id}
                    className="flex items-center gap-1 rounded-full bg-tomato/15 px-2 py-0.5 font-mono text-[10px] text-tomato"
                    title={t('goals.node.unfinishedDependency')}
                  >
                    ⛔ {b.title}
                    <button
                      onClick={() =>
                        goalsChange(
                          setGoalBlockedBy(
                            goals,
                            goal.id,
                            (goal.blockedBy ?? []).filter((id) => id !== b.id),
                          ),
                        )
                      }
                      className="press hover:text-cream"
                      aria-label={t('goals.node.removeDependencyAria', { title: b.title })}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            {depCandidates.length > 0 && (
              <div className="flex items-center gap-1.5">
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    goalsChange(
                      setGoalBlockedBy(goals, goal.id, [...(goal.blockedBy ?? []), e.target.value]),
                    );
                  }}
                  className="h-8 min-w-0 flex-1 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                  title={t('goals.node.dependencyTitle')}
                  aria-label={t('goals.node.addDependencyAria')}
                >
                  <option value="">{t('goals.node.dependsOn')}</option>
                  {depCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => onGenerate(goal)}
                className="press rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-sage ring-1 ring-inset ring-line hover:text-cream disabled:opacity-40"
                title={t('goals.node.generateTasksTitle')}
              >
                ⚙ {t('goals.node.generateTasks')}
              </button>
              <button
                onClick={() => onSendToToday(goal)}
                className="press rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-sage ring-1 ring-inset ring-line hover:text-cream"
                title={t('goals.node.sendToTodayTitle')}
              >
                ＋ {t('goals.node.sendToToday')}
              </button>
              <button
                onClick={() => goalsChange(updateGoal(goals, goal.id, { archived: true }))}
                className="press rounded-lg px-2.5 py-1.5 text-[11px] text-faint ring-1 ring-inset ring-line hover:text-cream"
              >
                {t('goals.node.archive')}
              </button>
              <button
                onClick={() => {
                  if (confirm(t('goals.node.deleteConfirm', { title: goal.title }))) {
                    goalsChange(deleteGoal(goals, goal.id));
                    onLinksChange(cleanupLinksFor(links, 'goal', goal.id));
                  }
                }}
                className="press ml-auto rounded-lg px-2.5 py-1.5 text-[11px] text-faint ring-1 ring-inset ring-line hover:text-tomato"
              >
                {t('goals.node.delete')}
              </button>
            </div>
            <LinkedItems
              entityType="goal"
              entityId={goal.id}
              links={links}
              onLinksChange={onLinksChange}
              goals={goals}
              projects={liveProjects}
              skills={skills}
              objectives={objectives}
            />
          </div>
        )}
      </div>
      {kids.length > 0 && (
        <ul className="ml-4 mt-2 space-y-2 border-l-2 border-line/50 pl-2">
          {kids.map((k) => (
            <GoalNode
              key={k.id}
              goal={k}
              goals={goals}
              goalsChange={goalsChange}
              liveProjects={liveProjects}
              lifeAreas={lifeAreas}
              tasks={tasks}
              progressOf={progressOf}
              ancestorIds={[...ancestorIds, goal.id]}
              onGenerate={onGenerate}
              onSendToToday={onSendToToday}
              links={links}
              onLinksChange={onLinksChange}
              skills={skills}
              objectives={objectives}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
