import { useMemo } from 'react';
import { ganttRows } from '../../lib/sprints';
import type { TimelineProps } from './types';

/** Gantt-style timeline: bars from creation to due/completion, today marker. */
export default function TimelineTab({ projectId, tasks }: TimelineProps) {
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
                {t.milestone === true ? (
                  <span title="Milestone">◆ </span>
                ) : (
                  critical && <span title="On the critical path">⛓ </span>
                )}
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
                          : 'rgb(242 244 249 / 0.28)',
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
