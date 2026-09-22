import { useMemo, useState } from 'react';
import type { Goal, GoalLevel } from '../lib/goals';
import {
  GOAL_LEVELS,
  GOAL_LEVEL_KEYS,
  GOAL_SHORT_KEYS,
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
import { AREA_LABEL_KEYS, type LifeArea } from '../lib/lifeAreas';
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
import { horizonToGoalLevel, type PlanningHorizon } from '../lib/horizons';
import type { TKey } from '../lib/i18n/types';

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
  const [draft, setDraft] = useState('');
  const [draftLevel, setDraftLevel] = useState<GoalLevel>('project');
  const [horizonFilter] = useState<PlanningHorizon | 'all'>('all');
  const [draftParent, setDraftParent] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const i18n = useI18n();
  const { t, tp, fmtNum } = i18n;

  const liveProjects = useMemo(() => activeProjects(projects), [projects]);
  const roots = useMemo(() => rootGoals(goals), [goals]);
  const visibleRoots = useMemo(() => {
    if (horizonFilter === 'all') return roots;
    const level = horizonToGoalLevel(horizonFilter);
    return roots.filter((g) => g.level === level);
  }, [roots, horizonFilter]);
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
    <section className="card flex h-full flex-col px-6 py-6 sm:px-7" aria-label={t('goal.aria')}>
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('goal.title')}
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-sage">
            {isPro ? t('goal.subPro') : t('goal.subFree', { n: fmtNum(FREE_GOALS_LIMIT) })}
          </p>
        </div>
      </header>

      {conflicts.length > 0 && (
        <p className="mt-3 rounded-lg bg-tomato/10 px-3 py-2 font-mono text-[11px] text-tomato ring-1 ring-inset ring-tomato/30">
          {tp('goal.clash', conflicts.length, {
            a: conflicts[0].a.title,
            b: conflicts[0].b.title,
            week: conflicts[0].week,
          })}
        </p>
      )}

      {roots.length === 0 ? (
        <div className="empty-panel mt-4">
          <p className="text-[13px] leading-relaxed text-sage">
            {t('goal.emptyA')}
            <br />
            {t('goal.emptyB')}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {visibleRoots.map((g) => (
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
              placeholder={t('goal.ph')}
              aria-label={t('goal.add')}
              className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
            <select
              value={draftLevel}
              onChange={(e) => {
                setDraftLevel(e.target.value as GoalLevel);
                setDraftParent('');
              }}
              className="h-9 shrink-0 rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              aria-label={t('goal.level')}
            >
              {GOAL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(GOAL_LEVEL_KEYS[l] as TKey)}
                </option>
              ))}
            </select>
            <button
              onClick={add}
              disabled={!draft.trim()}
              className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
              aria-label={t('goal.add')}
            >
              +
            </button>
          </div>
          {validParents(goals, draftLevel).length > 0 && (
            <select
              value={draftParent}
              onChange={(e) => setDraftParent(e.target.value)}
              className="h-9 w-full rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              aria-label={t('goal.parent')}
            >
              <option value="">{t('goal.noParent')}</option>
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
              {t('goal.cap', { n: fmtNum(FREE_GOALS_LIMIT) })}
            </p>
            <p className="mt-1 font-mono text-[11px] text-faint">{t('goal.capBody')}</p>
          </div>
        )
      )}

      {archived.length > 0 && (
        <div className="mt-3 border-t border-line/60 pt-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="press font-mono text-[11px] uppercase tracking-[0.18em] text-faint hover:text-sage"
          >
            {t('goal.archived', { n: fmtNum(archived.length) })} {showArchived ? '▴' : '▾'}
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
                    {t('goal.restore')}
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
  const [showDetails, setShowDetails] = useState(false);
  const i18n = useI18n();
  const { t } = i18n;
  const pct = progressOf.get(goal.id) ?? 0;
  const kids = childrenOf(goals, goal.id).filter((k) => !ancestorIds.includes(k.id));
  const linked = goal.projectId ? liveProjects.find((p) => p.id === goal.projectId) : null;
  const smart = useMemo(() => smartScore(goal.title, i18n), [goal.title, i18n]);
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
            {t(GOAL_SHORT_KEYS[goal.level] as TKey)}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-sage">{pct}%</span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="press shrink-0 rounded p-1 font-mono text-[11px] text-faint hover:text-cream"
            aria-label={t(showDetails ? 'goal.hideDetails' : 'goal.showDetails')}
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
                title={t('goal.linkTitle')}
              >
                <option value="">{t('goal.noProject')}</option>
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
                title={t('goal.targetDate')}
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
                  aria-label={t('goal.manual')}
                />
                <span className="font-mono text-[11px] text-sage">{goal.progress ?? 0}%</span>
              </div>
            )}
            {linked && (
              <p className="font-mono text-[10px] text-faint">
                {t('goal.mirrors', { name: linked.name })}
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
                    goalsChange(updateGoal(goals, goal.id, { capsuleNote: e.target.value || null }))
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
                title={t('goal.areaTitle')}
              >
                <option value="">{t('goal.noArea')}</option>
                {lifeAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {t(AREA_LABEL_KEYS[a.key] as TKey)}
                  </option>
                ))}
              </select>
              <span
                className="shrink-0 font-mono text-[10px] text-sage"
                title={smart.tips.length > 0 ? smart.tips.join(' ') : t('goal.smartFull')}
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
                    title={t('goal.depTitle')}
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
                      aria-label={t('goal.depRemove', { title: b.title })}
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
                  title={t('goal.depFirst')}
                  aria-label={t('goal.depAdd')}
                >
                  <option value="">{t('goal.depends')}</option>
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
                title={t('goal.genTitle')}
              >
                {t('goal.gen')}
              </button>
              <button
                onClick={() => onSendToToday(goal)}
                className="press rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-sage ring-1 ring-inset ring-line hover:text-cream"
                title={t('goal.todayTitle')}
              >
                {t('goal.today')}
              </button>
              <button
                onClick={() => goalsChange(updateGoal(goals, goal.id, { archived: true }))}
                className="press rounded-lg px-2.5 py-1.5 text-[11px] text-faint ring-1 ring-inset ring-line hover:text-cream"
              >
                {t('goal.archive')}
              </button>
              <button
                onClick={() => {
                  if (confirm(t('goal.delConfirm', { title: goal.title }))) {
                    goalsChange(deleteGoal(goals, goal.id));
                    onLinksChange(cleanupLinksFor(links, 'goal', goal.id));
                  }
                }}
                className="press ml-auto rounded-lg px-2.5 py-1.5 text-[11px] text-faint ring-1 ring-inset ring-line hover:text-tomato"
              >
                {t('goal.delete')}
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
