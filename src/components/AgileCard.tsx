import { useEffect, useMemo, useState } from 'react';
import type { Project } from '../lib/projects';
import { activeProjects } from '../lib/projects';
import type { Task, TaskStatus } from '../lib/tasks';
import {
  TASK_STATUSES,
  STATUS_LABELS,
  tasksForProject,
  updateTaskStatus,
  completeTask,
  criticalChain,
  taskPoints,
} from '../lib/tasks';
import type { Sprint } from '../lib/sprints';
import {
  loadBoardConfig,
  saveBoardConfig,
  createSprintObject,
  updateSprint,
  deleteSprint,
  addTasksToSprint,
  removeTaskFromSprint,
  pruneSprintTasks,
  sprintsForProject,
  sprintPoints,
  burndown,
  velocity,
  standup,
  formatStandup,
  ganttRows,
  type BoardConfig,
} from '../lib/sprints';
import type { WaterfallPhase } from '../lib/waterfall';
import {
  createPhaseObject,
  deletePhase,
  seedStarterPhases,
  setPhaseStatus,
  phasesForProject,
  waterfallProgress,
} from '../lib/waterfall';

interface Props {
  projects: Project[];
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  sprints: Sprint[];
  sprintsChange: (sprints: Sprint[]) => void;
  phases: WaterfallPhase[];
  phasesChange: (phases: WaterfallPhase[]) => void;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  isPro?: boolean;
}

type AgileTab = 'board' | 'sprints' | 'timeline' | 'waterfall';

const AGILE_TABS: Array<{ id: AgileTab; label: string }> = [
  { id: 'board', label: 'Board' },
  { id: 'sprints', label: 'Sprints' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'waterfall', label: 'Waterfall' },
];

const STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed'];

export default function AgileCard({
  projects,
  tasks,
  onTasksChange,
  sprints,
  sprintsChange,
  phases,
  phasesChange,
  selectedProjectId,
  onSelectProject,
  isPro = false,
}: Props) {
  const [tab, setTab] = useState<AgileTab>('board');
  const [board, setBoard] = useState<BoardConfig>(loadBoardConfig);
  const live = useMemo(() => activeProjects(projects), [projects]);
  const projectId = selectedProjectId ?? live[0]?.id ?? null;

  const commitBoard = (next: BoardConfig) => {
    saveBoardConfig(next);
    setBoard(next);
  };

  // Hygiene: drop sprint refs to deleted tasks (once per tasks change).
  useEffect(() => {
    const pruned = pruneSprintTasks(sprints, tasks);
    if (pruned.some((s, i) => s.taskIds.length !== sprints[i]?.taskIds.length)) {
      sprintsChange(pruned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="Agile board and sprints">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">Agile</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            Kanban · sprints
          </p>
        </div>
        {live.length > 0 && (
          <select
            value={projectId ?? ''}
            onChange={(e) => onSelectProject(e.target.value || null)}
            className="h-8 max-w-[150px] rounded-lg bg-ink/40 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
            aria-label="Board project"
          >
            {live.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="mt-4 flex gap-1 rounded-xl bg-ink/60 p-1 ring-1 ring-line w-fit">
        {AGILE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`press rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              tab === t.id ? 'bg-cream/10 text-cream' : 'text-faint hover:text-sage'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'board' && (
          <BoardTab
            projectId={projectId}
            tasks={tasks}
            onTasksChange={onTasksChange}
            board={board}
            commitBoard={commitBoard}
            isPro={isPro}
          />
        )}
        {tab === 'sprints' && (
          <SprintsTab
            projectId={projectId}
            tasks={tasks}
            onTasksChange={onTasksChange}
            sprints={sprints}
            sprintsChange={sprintsChange}
            isPro={isPro}
          />
        )}
        {tab === 'timeline' && <TimelineTab projectId={projectId} tasks={tasks} />}
        {tab === 'waterfall' && (
          <WaterfallTab projectId={projectId} phases={phases} phasesChange={phasesChange} />
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

interface BoardProps {
  projectId: string | null;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  board: BoardConfig;
  commitBoard: (board: BoardConfig) => void;
  isPro: boolean;
}

function BoardTab({ projectId, tasks, onTasksChange, board, commitBoard, isPro }: BoardProps) {
  const scoped = useMemo(
    () => (projectId ? tasksForProject(tasks, projectId) : []),
    [tasks, projectId],
  );
  const critical = useMemo(
    () =>
      isPro && projectId
        ? new Set(criticalChain(tasks, projectId).map((t) => t.id))
        : new Set<string>(),
    [tasks, projectId, isPro],
  );
  const flow = useMemo(() => {
    if (!isPro) return null;
    const done = scoped.filter(
      (t) => t.status === 'completed' && typeof t.completedAt === 'number',
    );
    const week = done.filter((t) => (t.completedAt as number) > Date.now() - 7 * 24 * 3600_000);
    const cycles = done
      .map((t) => ((t.completedAt as number) - t.createdAt) / (24 * 3600_000))
      .filter((d) => d >= 0);
    const avgCycle = cycles.length > 0 ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null;
    return { throughput: week.length, avgCycle };
  }, [scoped, isPro]);

  if (!projectId) {
    return (
      <p className="rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] text-faint">
        Create a project first — the board lives on projects.
      </p>
    );
  }

  const move = (task: Task, dir: -1 | 1) => {
    const idx = STATUS_ORDER.indexOf(task.status);
    const next = STATUS_ORDER[Math.min(3, Math.max(0, idx + dir))];
    if (next === task.status) return;
    if (next === 'completed') {
      onTasksChange(completeTask(tasks, task.id).tasks);
    } else {
      onTasksChange(updateTaskStatus(tasks, task.id, next));
    }
  };

  return (
    <div>
      {isPro && flow && (
        <p className="font-mono text-[11px] text-faint">
          {flow.throughput} done / 7d
          {flow.avgCycle !== null &&
            ` · avg cycle ${flow.avgCycle < 1 ? '<1d' : `${flow.avgCycle.toFixed(1)}d`}`}
        </p>
      )}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TASK_STATUSES.map((status) => {
          const col = scoped.filter((t) => t.status === status);
          const limit = board.wipLimits[status];
          const over = isPro && limit !== undefined && col.length > limit;
          return (
            <div
              key={status}
              className="rounded-xl bg-ink/40 px-3 py-2.5 ring-1 ring-inset ring-line"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-bold text-cream">
                  {STATUS_LABELS[status]}{' '}
                  <span
                    className={`font-mono text-[11px] ${over ? 'font-bold text-tomato' : 'text-faint'}`}
                  >
                    {col.length}
                    {isPro && limit !== undefined && `/${limit}`}
                  </span>
                </span>
                {isPro && (
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={limit ?? ''}
                    onChange={(e) => {
                      const v =
                        e.target.value === ''
                          ? undefined
                          : Math.max(1, Math.floor(Number(e.target.value) || 0));
                      const wipLimits = { ...board.wipLimits };
                      if (v === undefined) delete wipLimits[status];
                      else wipLimits[status] = v;
                      commitBoard({ wipLimits });
                    }}
                    placeholder="WIP"
                    className="h-6 w-14 rounded bg-ink/60 px-1.5 font-mono text-[10px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                    title="WIP limit (Pro)"
                  />
                )}
              </div>
              {over && (
                <p className="mt-1 font-mono text-[10px] font-bold text-tomato">
                  WIP exceeded — finish something first.
                </p>
              )}
              <ul className="mt-1.5 space-y-1">
                {col.slice(0, 6).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-1.5 rounded-lg bg-ink/50 px-2 py-1.5"
                  >
                    <button
                      onClick={() => move(t, -1)}
                      disabled={t.status === 'pending'}
                      className="press shrink-0 rounded px-1 font-mono text-[12px] text-faint hover:text-cream disabled:opacity-30"
                      aria-label="Move back"
                    >
                      ‹
                    </button>
                    <span
                      className="min-w-0 flex-1 truncate text-[12px] text-cream/90"
                      title={t.title}
                    >
                      {isPro && critical.has(t.id) && <span title="On the critical path">⛓ </span>}
                      {t.title}
                    </span>
                    {typeof t.points === 'number' && (
                      <span className="shrink-0 font-mono text-[10px] text-faint">
                        {t.points}pt
                      </span>
                    )}
                    <button
                      onClick={() => move(t, 1)}
                      disabled={t.status === 'completed'}
                      className="press shrink-0 rounded px-1 font-mono text-[12px] text-faint hover:text-cream disabled:opacity-30"
                      aria-label="Move forward"
                    >
                      ›
                    </button>
                  </li>
                ))}
                {col.length > 6 && (
                  <li className="font-mono text-[10px] text-faint">+{col.length - 6} more</li>
                )}
                {col.length === 0 && <li className="font-mono text-[10px] text-faint">Empty</li>}
              </ul>
            </div>
          );
        })}
      </div>
      {!isPro && (
        <p className="mt-3 font-mono text-[11px] text-faint">
          Pro adds WIP limits, flow metrics and critical-path flags.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface SprintsProps {
  projectId: string | null;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  sprints: Sprint[];
  sprintsChange: (sprints: Sprint[]) => void;
  isPro: boolean;
}

function SprintsTab({
  projectId,
  tasks,
  onTasksChange,
  sprints,
  sprintsChange,
  isPro,
}: SprintsProps) {
  const [name, setName] = useState('');
  const [length, setLength] = useState(14);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const scoped = useMemo(
    () => (projectId ? sprintsForProject(sprints, projectId) : []),
    [sprints, projectId],
  );
  const projectTasks = useMemo(
    () => (projectId ? tasks.filter((t) => t.projectId === projectId) : []),
    [tasks, projectId],
  );
  const vel = useMemo(
    () => (isPro && projectId ? velocity(sprints, tasks, projectId) : null),
    [sprints, tasks, projectId, isPro],
  );

  if (!projectId) {
    return (
      <p className="rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] text-faint">
        Create a project first — sprints live on projects.
      </p>
    );
  }

  const create = () => {
    const sprint = createSprintObject(
      projectId,
      name || `Sprint ${scoped.length + 1}`,
      Date.now(),
      length,
    );
    if (!sprint) return;
    sprintsChange([...sprints, sprint]);
    setName('');
  };

  return (
    <div>
      {vel !== null && (
        <p className="font-mono text-[11px] text-faint" title="Avg done-points, last 3 sprints">
          Velocity {vel} pts/sprint
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="Sprint name…"
          className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
        />
        <select
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="h-9 shrink-0 rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          aria-label="Sprint length"
        >
          <option value={7}>1 week</option>
          <option value={14}>2 weeks</option>
          <option value={28}>4 weeks</option>
        </select>
        <button
          onClick={create}
          className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold"
          aria-label="Create sprint"
        >
          +
        </button>
      </div>

      {scoped.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line/60 px-4 py-4 text-center text-[12px] text-faint">
          No sprints yet. Plan one above, pull tasks in, close it for velocity.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {scoped.slice(0, 5).map((s) => (
            <SprintRow
              key={s.id}
              sprint={s}
              tasks={tasks}
              projectTasks={projectTasks}
              onTasksChange={onTasksChange}
              sprints={sprints}
              sprintsChange={sprintsChange}
              addingTo={addingTo}
              setAddingTo={setAddingTo}
              isPro={isPro}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface SprintRowProps {
  sprint: Sprint;
  tasks: Task[];
  projectTasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  sprints: Sprint[];
  sprintsChange: (sprints: Sprint[]) => void;
  addingTo: string | null;
  setAddingTo: (id: string | null) => void;
  isPro: boolean;
}

function SprintRow({
  sprint,
  tasks,
  projectTasks,
  onTasksChange,
  sprints,
  sprintsChange,
  addingTo,
  setAddingTo,
  isPro,
}: SprintRowProps) {
  const [retro, setRetro] = useState(sprint.retro ?? '');
  const pts = sprintPoints(sprint, tasks);
  const members = useMemo(() => {
    const index = new Map(tasks.map((t) => [t.id, t]));
    return sprint.taskIds
      .map((id) => index.get(id))
      .filter((t): t is Task => !!t && t.projectId === sprint.projectId);
  }, [sprint, tasks]);
  const series = useMemo(
    () => (isPro && sprint.status !== 'planned' ? burndown(sprint, tasks) : []),
    [sprint, tasks, isPro],
  );
  const standupText = useMemo(() => formatStandup(standup(sprint, tasks)), [sprint, tasks]);
  const candidates = projectTasks.filter((t) => !sprint.taskIds.includes(t.id));

  const copyStandup = async () => {
    try {
      await navigator.clipboard.writeText(standupText);
    } catch {
      /* clipboard unavailable — text stays visible below */
    }
  };

  return (
    <li className="rounded-xl bg-ink/40 px-3.5 py-3 ring-1 ring-inset ring-line">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${sprint.status === 'active' ? 'bg-accent' : sprint.status === 'completed' ? 'bg-sage' : 'bg-line'}`}
          title={sprint.status}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-cream">
          {sprint.name}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-sage">
          {pts.done}/{pts.total}pt · {pts.pct}%
        </span>
        {sprint.status === 'planned' && (
          <button
            onClick={() => sprintsChange(updateSprint(sprints, sprint.id, { status: 'active' }))}
            className="press shrink-0 rounded-md px-2 py-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
          >
            Start
          </button>
        )}
        {sprint.status === 'active' && (
          <button
            onClick={() => sprintsChange(updateSprint(sprints, sprint.id, { status: 'completed' }))}
            className="press shrink-0 rounded-md px-2 py-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
          >
            Close
          </button>
        )}
        <button
          onClick={() => {
            if (confirm(`Delete sprint “${sprint.name}”? Tasks stay.`)) {
              sprintsChange(deleteSprint(sprints, sprint.id));
            }
          }}
          className="press shrink-0 rounded p-1 text-faint hover:text-tomato"
          aria-label={`Delete ${sprint.name}`}
        >
          ✕
        </button>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pts.pct}%`,
            background: 'linear-gradient(90deg, var(--accent-deep), var(--accent))',
          }}
        />
      </div>

      {members.length > 0 && (
        <ul className="mt-2 space-y-1">
          {members.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-lg bg-ink/50 px-2 py-1.5">
              <button
                onClick={() => {
                  const next =
                    t.status === 'completed'
                      ? updateTaskStatus(tasks, t.id, 'pending')
                      : completeTask(tasks, t.id).tasks;
                  onTasksChange(next);
                }}
                className={`press flex shrink-0 items-center justify-center rounded ring-1 ring-inset ${
                  t.status === 'completed'
                    ? 'bg-accent text-on-accent ring-accent'
                    : 'bg-ink/60 text-transparent ring-line'
                }`}
                style={{ width: 18, height: 18 }}
                aria-label={`Toggle ${t.title}`}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              </button>
              <span
                className={`min-w-0 flex-1 truncate text-[12px] text-cream/90 ${t.status === 'completed' ? 'line-through opacity-60' : ''}`}
              >
                {t.title}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-faint">{taskPoints(t)}pt</span>
              <button
                onClick={() => sprintsChange(removeTaskFromSprint(sprints, sprint.id, t.id))}
                className="press shrink-0 rounded px-1 font-mono text-[11px] text-faint hover:text-tomato"
                aria-label={`Pull ${t.title} out of sprint`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {addingTo === sprint.id ? (
        <div className="mt-2 space-y-1">
          {candidates.length === 0 ? (
            <p className="font-mono text-[10px] text-faint">Every project task is already in.</p>
          ) : (
            candidates.slice(0, 8).map((t) => (
              <button
                key={t.id}
                onClick={() => sprintsChange(addTasksToSprint(sprints, tasks, sprint.id, [t.id]))}
                className="press block w-full truncate rounded-lg bg-ink/50 px-2.5 py-1.5 text-left text-[12px] text-sage ring-1 ring-inset ring-line hover:text-cream"
              >
                + {t.title}
              </button>
            ))
          )}
          <button
            onClick={() => setAddingTo(null)}
            className="press font-mono text-[10px] text-faint hover:text-cream"
          >
            Done
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingTo(sprint.id)}
          className="press mt-2 font-mono text-[11px] text-sage hover:text-cream"
        >
          + Pull tasks in
        </button>
      )}

      {isPro && series.length > 1 && (
        <div className="mt-2.5 border-t border-line/60 pt-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
            Burndown · remaining pts
          </p>
          <div
            className="mt-1.5 flex h-12 items-end gap-[3px]"
            title="Actual (bars) vs ideal (line)"
          >
            {series.slice(-21).map((d) => {
              const max = Math.max(1, ...series.map((x) => Math.max(x.actual, x.ideal)));
              return (
                <div
                  key={d.dayKey}
                  className="flex-1 rounded-t-sm bg-cream/25"
                  style={{ height: `${Math.max(4, (d.actual / max) * 100)}%` }}
                  title={`${d.label}: ${d.actual} left (ideal ${d.ideal})`}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-2.5 border-t border-line/60 pt-2">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">Standup</p>
          <button
            onClick={copyStandup}
            className="press font-mono text-[10px] text-sage hover:text-cream"
          >
            Copy
          </button>
        </div>
        <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-sage">
          {standupText}
        </pre>
      </div>

      <textarea
        value={retro}
        rows={2}
        maxLength={2000}
        onChange={(e) => setRetro(e.target.value)}
        onBlur={() => {
          if ((retro.trim() || '') !== (sprint.retro ?? '')) {
            sprintsChange(updateSprint(sprints, sprint.id, { retro: retro.trim() || null }));
          }
        }}
        placeholder="Retro notes… (saved on blur)"
        className="mt-2 w-full resize-y rounded-lg bg-ink/50 px-2.5 py-2 text-[12px] leading-relaxed text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
      />
    </li>
  );
}

/* ------------------------------------------------------------------ */

interface TimelineProps {
  projectId: string | null;
  tasks: Task[];
}

/** Gantt-style timeline: bars from creation to due/completion, today marker. */
function TimelineTab({ projectId, tasks }: TimelineProps) {
  const now = useMemo(() => Date.now(), []);
  const window = useMemo(
    () => (projectId ? ganttRows(tasks, projectId, now) : null),
    [tasks, projectId, now],
  );

  if (!projectId) {
    return (
      <p className="rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] text-faint">
        Create a project first — the timeline lives on projects.
      </p>
    );
  }
  if (!window || window.rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] text-faint">
        No tasks yet — add tasks and set due dates to see the timeline.
      </p>
    );
  }
  const span = Math.max(1, window.windowEnd - window.windowStart);
  const todayPct = Math.min(100, Math.max(0, ((now - window.windowStart) / span) * 100));
  const overdueCount = window.rows.filter((r) => r.overdue).length;

  return (
    <div>
      <p className="font-mono text-[11px] text-faint">
        {window.rows.length} task{window.rows.length === 1 ? '' : 's'} · 2 weeks back / 4 ahead
        {overdueCount > 0 && (
          <span className="ml-2 font-bold text-tomato">{overdueCount} overdue</span>
        )}
      </p>
      <div className="relative mt-2 space-y-1.5">
        <div
          className="pointer-events-none absolute bottom-0 top-0 w-px bg-accent/70"
          style={{ left: `calc(128px + (100% - 128px) * ${todayPct / 100})` }}
          title="Today"
        />
        {window.rows.slice(0, 20).map(({ task: t, start, end, overdue, critical }) => {
          const left = ((start - window.windowStart) / span) * 100;
          const width = Math.max(2, ((end - start) / span) * 100);
          const done = t.status === 'completed';
          return (
            <div key={t.id} className="flex items-center gap-2">
              <span
                className="w-[120px] shrink-0 truncate text-[11px] text-cream/80"
                title={t.title}
              >
                {critical && <span title="On the critical path">⛓ </span>}
                {t.title}
              </span>
              <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded bg-ink/60 ring-1 ring-inset ring-line/50">
                <div
                  className="absolute top-0 h-full rounded"
                  style={{
                    left: `${left}%`,
                    width: `${Math.min(100 - left, width)}%`,
                    background: done
                      ? 'rgb(148 163 152 / 0.5)'
                      : overdue
                        ? 'var(--tomato, #e5484d)'
                        : critical
                          ? 'var(--accent)'
                          : 'rgb(238 241 232 / 0.28)',
                  }}
                  title={`${t.title}: ${new Date(start).toLocaleDateString()} → ${new Date(end).toLocaleDateString()}${overdue ? ' (overdue)' : ''}`}
                />
              </div>
            </div>
          );
        })}
        {window.rows.length > 20 && (
          <p className="font-mono text-[10px] text-faint">+{window.rows.length - 20} more</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface WaterfallProps {
  projectId: string | null;
  phases: WaterfallPhase[];
  phasesChange: (phases: WaterfallPhase[]) => void;
}

/** Sequential phases with gates: strict todo → active → done. */
function WaterfallTab({ projectId, phases, phasesChange }: WaterfallProps) {
  const [name, setName] = useState('');
  const [gate, setGate] = useState('');
  const scoped = useMemo(
    () => (projectId ? phasesForProject(phases, projectId) : []),
    [phases, projectId],
  );
  const pct = projectId ? waterfallProgress(phases, projectId) : 0;

  if (!projectId) {
    return (
      <p className="rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] text-faint">
        Create a project first — phases live on projects.
      </p>
    );
  }

  const add = () => {
    const phase = createPhaseObject(projectId, name, scoped.length, gate || undefined);
    if (!phase) return;
    phasesChange([...phases, phase]);
    setName('');
    setGate('');
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--accent-deep), var(--accent))',
            }}
          />
        </div>
        <span className="shrink-0 font-mono text-[11px] text-sage">{pct}%</span>
      </div>

      {scoped.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-line/60 px-4 py-5 text-center">
          <p className="text-[12px] text-faint">No phases yet.</p>
          <button
            onClick={() => phasesChange(seedStarterPhases(phases, projectId))}
            className="press btn-accent mt-2 rounded-lg px-4 py-2 text-sm font-semibold"
          >
            Start classic pipeline
          </button>
        </div>
      ) : (
        <ol className="mt-3 space-y-0">
          {scoped.map((p, i) => (
            <li key={p.id} className="relative flex gap-3 pb-3 last:pb-0">
              {i < scoped.length - 1 && (
                <span
                  className={`absolute left-[7px] top-5 h-[calc(100%-16px)] w-px ${p.status === 'done' ? 'bg-accent/60' : 'bg-line'}`}
                  aria-hidden
                />
              )}
              <span
                className={`mt-1 h-[15px] w-[15px] shrink-0 rounded-full ring-2 ${
                  p.status === 'done'
                    ? 'bg-accent ring-accent'
                    : p.status === 'active'
                      ? 'bg-ink ring-accent'
                      : 'bg-ink ring-line'
                }`}
                title={p.status}
              />
              <div className="min-w-0 flex-1 rounded-xl bg-ink/40 px-3 py-2 ring-1 ring-inset ring-line">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-faint">#{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-cream">
                    {p.name}
                  </span>
                  {p.status === 'todo' && (
                    <button
                      onClick={() => phasesChange(setPhaseStatus(phases, p.id, 'active'))}
                      className="press shrink-0 rounded-md px-2 py-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
                      title={
                        scoped.slice(0, i).every((x) => x.status === 'done')
                          ? 'Start phase'
                          : 'Finish earlier phases first'
                      }
                    >
                      Start
                    </button>
                  )}
                  {p.status === 'active' && (
                    <button
                      onClick={() => phasesChange(setPhaseStatus(phases, p.id, 'done'))}
                      className="press shrink-0 rounded-md px-2 py-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
                      title={p.gate ? `Gate: ${p.gate}` : 'Complete phase'}
                    >
                      Complete
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Delete phase “${p.name}”?`)) {
                        phasesChange(deletePhase(phases, p.id));
                      }
                    }}
                    className="press shrink-0 rounded p-1 font-mono text-[10px] text-faint hover:text-tomato"
                    aria-label={`Delete ${p.name}`}
                  >
                    ✕
                  </button>
                </div>
                {p.gate && (
                  <p className="mt-0.5 font-mono text-[10px] text-faint">Gate: {p.gate}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Phase name…"
          className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
        />
        <input
          type="text"
          value={gate}
          maxLength={200}
          onChange={(e) => setGate(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Exit gate…"
          className="h-9 w-32 shrink-0 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
          aria-label="Add phase"
        >
          +
        </button>
      </div>
    </div>
  );
}
