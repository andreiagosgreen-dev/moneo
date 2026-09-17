import { useMemo } from 'react';
import type { Task, TaskQuadrant } from '../lib/tasks';
import { TASK_QUADRANTS, setTaskQuadrant } from '../lib/tasks';
import {
  QUADRANT_META,
  effectiveQuadrant,
  quadrantCounts,
  quadrantFocus,
  quadrantMinutes,
  tasksInQuadrant,
} from '../lib/eisenhower';
import { formatProjectDuration } from '../lib/projects';

interface Props {
  tasks: Task[];
  history: Array<{ taskId?: string; min: number }>;
  onTasksChange: (tasks: Task[]) => void;
  isPro?: boolean;
}

function dueBadge(task: Task): string | null {
  if (typeof task.dueAt !== 'number') return null;
  const d = new Date(task.dueAt);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MatrixCard({ tasks, history, onTasksChange, isPro = false }: Props) {
  // Snapshot per mount: the board re-derives whenever tasks/history change.
  const now = useMemo(() => Date.now(), []);
  const counts = useMemo(() => quadrantCounts(tasks, now), [tasks, now]);
  const minutes = useMemo(
    () => (isPro ? quadrantMinutes(tasks, history, now) : null),
    [tasks, history, isPro, now],
  );
  const focus = useMemo(() => (isPro ? quadrantFocus(tasks, now) : null), [tasks, isPro, now]);
  const total = counts.q1 + counts.q2 + counts.q3 + counts.q4;

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="Eisenhower matrix">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">Matrix</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {isPro ? 'Urgent vs important · yours to override' : 'Urgent vs important · auto-sorted'}
          </p>
        </div>
        <span className="font-mono text-[11px] text-sage">{total} active</span>
      </header>

      {focus && focus.quadrant && (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">
          <p className="text-[13px] font-semibold text-cream">
            {QUADRANT_META[focus.quadrant].action}: {focus.task?.title}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-faint">{focus.headline}</p>
        </div>
      )}

      {total === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] leading-relaxed text-faint">
          No open tasks. Add tasks to projects and they land here automatically.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TASK_QUADRANTS.map((q: TaskQuadrant) => {
            const meta = QUADRANT_META[q];
            const inQ = tasksInQuadrant(tasks, q, now);
            return (
              <div key={q} className="rounded-xl bg-ink/40 px-3.5 py-3 ring-1 ring-inset ring-line">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-bold text-cream">
                    {meta.title}
                    <span className="ml-1.5 font-mono text-[10px] font-normal text-faint">
                      {meta.hint}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-sage">
                    {counts[q]}
                    {minutes && minutes[q] > 0 && (
                      <span className="ml-1 text-faint">· {formatProjectDuration(minutes[q])}</span>
                    )}
                  </span>
                </div>
                {inQ.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {inQ.slice(0, 5).map((t) => {
                      const badge = dueBadge(t);
                      const auto = effectiveQuadrant(t, now) === q && t.quadrant !== q;
                      return (
                        <li
                          key={t.id}
                          className="flex items-center gap-1.5 rounded-lg bg-ink/50 px-2 py-1.5"
                        >
                          <span className="min-w-0 flex-1 truncate text-[12px] text-cream/90">
                            {t.title}
                          </span>
                          {badge && (
                            <span className="shrink-0 font-mono text-[10px] text-faint">
                              {badge}
                            </span>
                          )}
                          {isPro && (
                            <select
                              value={t.quadrant ?? ''}
                              onChange={(e) =>
                                onTasksChange(
                                  setTaskQuadrant(
                                    tasks,
                                    t.id,
                                    (e.target.value || null) as TaskQuadrant | null,
                                  ),
                                )
                              }
                              className="h-6 shrink-0 rounded bg-ink/60 px-1 font-mono text-[10px] text-faint ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                              title={
                                auto
                                  ? 'Auto-placed — pick a quadrant to override'
                                  : 'Quadrant override (empty = auto)'
                              }
                            >
                              <option value="">A</option>
                              {TASK_QUADRANTS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          )}
                        </li>
                      );
                    })}
                    {inQ.length > 5 && (
                      <li className="font-mono text-[10px] text-faint">+{inQ.length - 5} more</li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isPro && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
          <p className="text-[12px] leading-relaxed text-cream">
            Pro unlocks manual quadrant overrides, time per quadrant and daily focus picks.
          </p>
        </div>
      )}
    </section>
  );
}
