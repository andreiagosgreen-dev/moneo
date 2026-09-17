import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '../../lib/tasks';
import {
  TASK_STATUSES,
  STATUS_LABELS,
  tasksForProject,
  updateTaskStatus,
  completeTask,
  criticalChain,
} from '../../lib/tasks';
import type { BoardProps } from './types';
const STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed'];

export default function BoardTab({
  projectId,
  tasks,
  onTasksChange,
  board,
  commitBoard,
  isPro,
}: BoardProps) {
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

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [lanes, setLanes] = useState<'off' | 'priority'>('off');

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
    moveTo(task, next);
  };

  const moveTo = (task: Task, status: TaskStatus) => {
    if (status === task.status) return;
    if (status === 'completed') {
      onTasksChange(completeTask(tasks, task.id).tasks);
    } else {
      onTasksChange(updateTaskStatus(tasks, task.id, status));
    }
  };

  const dropOnto = (status: TaskStatus) => {
    const task = tasks.find((t) => t.id === dragId);
    setDragId(null);
    setDragOver(null);
    if (!task || task.projectId !== projectId) return;
    moveTo(task, status);
  };

  const laneGroups = (col: Task[]): Array<{ label: string | null; items: Task[] }> => {
    if (lanes === 'off') return [{ label: null, items: col.slice(0, 6) }];
    const order: Task['priority'][] = ['p0', 'p1', 'p2', 'p3'];
    return order
      .map((p) => ({
        label: p.toUpperCase(),
        items: col.filter((t) => t.priority === p).slice(0, 4),
      }))
      .filter((g) => g.items.length > 0);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        {isPro && flow ? (
          <p className="font-mono text-[11px] text-faint">
            {flow.throughput} done / 7d
            {flow.avgCycle !== null &&
              ` · avg cycle ${flow.avgCycle < 1 ? '<1d' : `${flow.avgCycle.toFixed(1)}d`}`}
          </p>
        ) : (
          <span />
        )}
        <button
          onClick={() => setLanes(lanes === 'off' ? 'priority' : 'off')}
          className={`press shrink-0 rounded-md px-2 py-1 font-mono text-[10px] ring-1 ring-inset ${
            lanes === 'priority'
              ? 'text-accent ring-accent/50'
              : 'text-faint ring-line hover:text-cream'
          }`}
          aria-pressed={lanes === 'priority'}
          title="Group cards by priority swimlanes"
        >
          Lanes: {lanes === 'off' ? 'off' : 'P0–P3'}
        </button>
      </div>
      {isPro && (
        <details className="mt-2">
          <summary className="cursor-pointer font-mono text-[10px] text-faint hover:text-cream">
            Board settings · labels & hidden columns
          </summary>
          <div className="mt-1.5 space-y-1">
            {TASK_STATUSES.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <input
                  type="text"
                  value={board.columnLabels[s] ?? ''}
                  maxLength={24}
                  onChange={(e) => {
                    const columnLabels = { ...board.columnLabels };
                    if (e.target.value.trim()) columnLabels[s] = e.target.value.trim();
                    else delete columnLabels[s];
                    commitBoard({ ...board, columnLabels });
                  }}
                  placeholder={STATUS_LABELS[s]}
                  className="h-7 min-w-0 flex-1 rounded-lg bg-ink/50 px-2 font-mono text-[11px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                  aria-label={`Label for ${STATUS_LABELS[s]}`}
                />
                <button
                  onClick={() => {
                    const hidden = board.hidden.includes(s)
                      ? board.hidden.filter((x) => x !== s)
                      : [...board.hidden, s];
                    commitBoard({ ...board, hidden });
                  }}
                  className={`press shrink-0 rounded-md px-2 py-1 font-mono text-[10px] ring-1 ring-inset ${
                    board.hidden.includes(s)
                      ? 'text-tomato ring-tomato/40'
                      : 'text-faint ring-line hover:text-cream'
                  }`}
                  aria-pressed={board.hidden.includes(s)}
                  title={board.hidden.includes(s) ? 'Show column' : 'Hide column'}
                >
                  {board.hidden.includes(s) ? 'Hidden' : 'Hide'}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TASK_STATUSES.filter((s) => !board.hidden.includes(s)).map((status) => {
          const col = scoped.filter((t) => t.status === status);
          const limit = board.wipLimits[status];
          const over = isPro && limit !== undefined && col.length > limit;
          const hot = dragOver === status;
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver((cur) => (cur === status ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                dropOnto(status);
              }}
              className={`rounded-xl bg-ink/40 px-3 py-2.5 ring-1 ring-inset transition-colors ${
                hot ? 'ring-accent' : 'ring-line'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-bold text-cream">
                  {board.columnLabels[status] ?? STATUS_LABELS[status]}{' '}
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
                      commitBoard({ ...board, wipLimits });
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
                {laneGroups(col).map((group) => (
                  <li key={group.label ?? 'all'}>
                    {group.label && (
                      <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-faint">
                        {group.label}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {group.items.map((t) => (
                        <li
                          key={t.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', t.id);
                            setDragId(t.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragOver(null);
                          }}
                          className={`flex cursor-grab items-center gap-1.5 rounded-lg bg-ink/50 px-2 py-1.5 active:cursor-grabbing ${
                            dragId === t.id ? 'opacity-50' : ''
                          }`}
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
                            title={`${t.title} · drag to another column`}
                          >
                            {isPro && critical.has(t.id) && (
                              <span title="On the critical path">⛓ </span>
                            )}
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
                    </ul>
                  </li>
                ))}
                {lanes === 'off' && col.length > 6 && (
                  <li className="font-mono text-[10px] text-faint">+{col.length - 6} more</li>
                )}
                {col.length === 0 && (
                  <li className="font-mono text-[10px] text-faint">Empty — drop cards here</li>
                )}
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
