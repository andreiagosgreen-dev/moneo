import { useMemo, useState } from 'react';
import type { Goal, GoalLevel } from '../lib/goals';
import {
  GOAL_LEVELS,
  GOAL_LEVEL_LABELS,
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
import { activeProjects } from '../lib/projects';
import type { Task } from '../lib/tasks';
import { createTaskObject } from '../lib/tasks';
import { addTaskToDay, IVY_MAX_TASKS, IVY_FREE_MAX_TASKS, type IvyPlan } from '../lib/ivyLee';
import { dayKeyInTz } from '../lib/timezone';

interface Props {
  goals: Goal[];
  goalsChange: (goals: Goal[]) => void;
  projects: Project[];
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  ivyPlans: IvyPlan[];
  onIvyPlansChange: (plans: IvyPlan[]) => void;
  timezone: string;
  lifeAreas: LifeArea[];
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
  tasks,
  onTasksChange,
  ivyPlans,
  onIvyPlansChange,
  timezone,
  lifeAreas,
  isPro = false,
}: Props) {
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

  const generateTasks = (goal: Goal) => {
    const target =
      (goal.projectId && liveProjects.find((p) => p.id === goal.projectId)) ?? liveProjects[0];
    if (!target) return;
    const titles = suggestTasksForGoal(goal.title);
    let next = tasks;
    for (const title of titles) {
      next = [...next, createTaskObject(target.id, title, 'p2')];
    }
    onTasksChange(next);
  };

  const sendToToday = (goal: Goal) => {
    const { plans, added } = addTaskToDay(ivyPlans, todayKey, `🎯 ${goal.title}`, maxIvy);
    if (added) onIvyPlansChange(plans);
  };

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="Goal hierarchy">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">Goals</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {isPro
              ? 'Big goals, broken into milestones and weeks'
              : `Big goals, broken down · free holds ${FREE_GOALS_LIMIT}`}
          </p>
        </div>
      </header>

      {conflicts.length > 0 && (
        <p className="mt-3 rounded-lg bg-tomato/10 px-3 py-2 font-mono text-[11px] text-tomato ring-1 ring-inset ring-tomato/30">
          ⚠ {conflicts.length} target-week clash{conflicts.length === 1 ? '' : 'es'}: "
          {conflicts[0].a.title}" × "{conflicts[0].b.title}" ({conflicts[0].week})
        </p>
      )}

      {roots.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] leading-relaxed text-faint">
          Set a yearly vision, break it into milestones.
          <br />
          Progress rolls up automatically.
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
              placeholder="e.g. Launch the SaaS…"
              className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
            <select
              value={draftLevel}
              onChange={(e) => {
                setDraftLevel(e.target.value as GoalLevel);
                setDraftParent('');
              }}
              className="h-9 shrink-0 rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              aria-label="Goal level"
            >
              {GOAL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {GOAL_LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
            <button
              onClick={add}
              disabled={!draft.trim()}
              className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
              aria-label="Add goal"
            >
              +
            </button>
          </div>
          {validParents(goals, draftLevel).length > 0 && (
            <select
              value={draftParent}
              onChange={(e) => setDraftParent(e.target.value)}
              className="h-9 w-full rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              aria-label="Parent goal (optional)"
            >
              <option value="">No parent (root)</option>
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
              Free plan holds up to {FREE_GOALS_LIMIT} goals.
            </p>
            <p className="mt-1 font-mono text-[11px] text-faint">
              Upgrade to Pro for an unlimited hierarchy.
            </p>
          </div>
        )
      )}

      {archived.length > 0 && (
        <div className="mt-3 border-t border-line/60 pt-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="press font-mono text-[11px] uppercase tracking-[0.18em] text-faint hover:text-sage"
          >
            Archived ({archived.length}) {showArchived ? '▴' : '▾'}
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
                    Restore
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
}: NodeProps) {
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
            {GOAL_LEVEL_LABELS[goal.level].split(' ')[0]}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-sage">{pct}%</span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="press shrink-0 rounded p-1 font-mono text-[11px] text-faint hover:text-cream"
            aria-label={`${showDetails ? 'Hide' : 'Show'} details`}
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
                title="Linked project (progress mirrors its tasks)"
              >
                <option value="">No linked project</option>
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
                title="Target date"
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
                  aria-label="Manual progress"
                />
                <span className="font-mono text-[11px] text-sage">{goal.progress ?? 0}%</span>
              </div>
            )}
            {linked && (
              <p className="font-mono text-[10px] text-faint">
                Progress mirrors “{linked.name}” tasks.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={goal.lifeAreaId ?? ''}
                onChange={(e) =>
                  goalsChange(updateGoal(goals, goal.id, { lifeAreaId: e.target.value || null }))
                }
                className="h-8 min-w-0 flex-1 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title="Linked life area"
              >
                <option value="">No life area</option>
                {lifeAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <span
                className="shrink-0 font-mono text-[10px] text-sage"
                title={
                  smart.tips.length > 0
                    ? smart.tips.join(' ')
                    : 'SMART: specific, measurable, achievable, relevant, time-bound'
                }
              >
                SMART {smart.score}/5
              </span>
            </div>
            {blockers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {blockers.map((b) => (
                  <span
                    key={b.id}
                    className="flex items-center gap-1 rounded-full bg-tomato/15 px-2 py-0.5 font-mono text-[10px] text-tomato"
                    title="Unfinished dependency"
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
                      aria-label={`Remove dependency ${b.title}`}
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
                  title="Finish first (dependency)"
                  aria-label="Add goal dependency"
                >
                  <option value="">Depends on…</option>
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
                disabled={liveProjects.length === 0}
                className="press rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-sage ring-1 ring-inset ring-line hover:text-cream disabled:opacity-40"
                title="Create starter tasks from this goal"
              >
                ⚙ Generate tasks
              </button>
              <button
                onClick={() => onSendToToday(goal)}
                className="press rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-sage ring-1 ring-inset ring-line hover:text-cream"
                title="Add to today's Ivy Lee plan"
              >
                ＋ Today
              </button>
              <button
                onClick={() => goalsChange(updateGoal(goals, goal.id, { archived: true }))}
                className="press rounded-lg px-2.5 py-1.5 text-[11px] text-faint ring-1 ring-inset ring-line hover:text-cream"
              >
                Archive
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete “${goal.title}”? Children re-attach upward.`)) {
                    goalsChange(deleteGoal(goals, goal.id));
                  }
                }}
                className="press ml-auto rounded-lg px-2.5 py-1.5 text-[11px] text-faint ring-1 ring-inset ring-line hover:text-tomato"
              >
                Delete
              </button>
            </div>
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
            />
          ))}
        </ul>
      )}
    </li>
  );
}
