import { useMemo } from 'react';
import type { Task, TaskQuadrant } from '../lib/tasks';
import { TASK_QUADRANTS, setTaskQuadrant } from '../lib/tasks';
import {
  QUADRANT_TEXT_KEYS,
  effectiveQuadrant,
  quadrantCounts,
  quadrantFocus,
  quadrantMinutes,
  tasksInQuadrant,
} from '../lib/eisenhower';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

interface Props {
  tasks: Task[];
  history: Array<{ taskId?: string; min: number }>;
  onTasksChange: (tasks: Task[]) => void;
  isPro?: boolean;
  /** Project-task ids already on today's plan. */
  planTaskIds?: Set<string>;
  /** Add a project task into today's Ivy plan. */
  onAddToPlan?: (task: Task) => boolean;
}

function dueBadge(task: Task, tag: string): string | null {
  if (typeof task.dueAt !== 'number') return null;
  const d = new Date(task.dueAt);
  try {
    return d.toLocaleDateString(tag, { month: 'short', day: 'numeric' });
  } catch {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export default function MatrixCard({
  tasks,
  history,
  onTasksChange,
  isPro = false,
  planTaskIds,
  onAddToPlan,
}: Props) {
  const i18n = useI18n();
  const { t, tag, fmtDur, fmtNum } = i18n;
  // Snapshot per mount: the board re-derives whenever tasks/history change.
  const now = useMemo(() => Date.now(), []);
  const counts = useMemo(() => quadrantCounts(tasks, now), [tasks, now]);
  const minutes = useMemo(
    () => (isPro ? quadrantMinutes(tasks, history, now) : null),
    [tasks, history, isPro, now],
  );
  const focus = useMemo(
    () => (isPro ? quadrantFocus(tasks, now, i18n) : null),
    [tasks, isPro, now, i18n],
  );
  const total = counts.q1 + counts.q2 + counts.q3 + counts.q4;

  return (
    <section className="card flex h-full min-w-0 flex-col px-6 py-6 sm:px-7" aria-label={t('matrix.aria')}>
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('matrix.title')}
          </h2>
          <p className="mt-1.5 text-[13px] leading-snug text-sage">
            {t(isPro ? 'matrix.subPro' : 'matrix.subFree')}
          </p>
        </div>
        <span className="text-[13px] font-medium text-sage">
          {t('matrix.active', { n: fmtNum(total) })}
        </span>
      </header>

      {focus && focus.quadrant && (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">
          <p className="text-[14px] font-semibold text-cream">
            {t(QUADRANT_TEXT_KEYS[focus.quadrant].action as TKey)}: {focus.task?.title}
          </p>
          <p className="mt-0.5 text-[13px] text-sage">{focus.headline}</p>
          {focus.task && onAddToPlan && (
            <button
              type="button"
              disabled={planTaskIds?.has(focus.task.id)}
              onClick={() => onAddToPlan(focus.task!)}
              className="press mt-2 rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-cream disabled:opacity-50"
            >
              {planTaskIds?.has(focus.task.id) ? t('matrix.onPlan') : t('matrix.addToPlan')}
            </button>
          )}
        </div>
      )}

      {total === 0 ? (
        <div className="empty-panel mt-4">
          <p>{t('matrix.empty')}</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TASK_QUADRANTS.map((q: TaskQuadrant) => {
            const meta = QUADRANT_TEXT_KEYS[q];
            const inQ = tasksInQuadrant(tasks, q, now);
            return (
              <div key={q} className="rounded-xl bg-ink/40 px-3.5 py-3 ring-1 ring-inset ring-line">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-bold text-cream">
                    {t(meta.title as TKey)}
                    <span className="ml-1.5 font-mono text-[10px] font-normal text-faint">
                      {t(meta.hint as TKey)}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-sage">
                    {fmtNum(counts[q])}
                    {minutes && minutes[q] > 0 && (
                      <span className="ml-1 text-faint">· {fmtDur(minutes[q])}</span>
                    )}
                  </span>
                </div>
                {inQ.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {inQ.slice(0, 5).map((task) => {
                      const badge = dueBadge(task, tag);
                      const auto = effectiveQuadrant(task, now) === q && task.quadrant !== q;
                      return (
                        <li
                          key={task.id}
                          className="flex items-center gap-1.5 rounded-lg bg-ink/50 px-2 py-1.5"
                        >
                          <span className="min-w-0 flex-1 truncate text-[12px] text-cream/90">
                            {task.title}
                          </span>
                          {badge && (
                            <span className="shrink-0 font-mono text-[10px] text-faint">
                              {badge}
                            </span>
                          )}
                          {isPro && (
                            <select
                              value={task.quadrant ?? ''}
                              onChange={(e) =>
                                onTasksChange(
                                  setTaskQuadrant(
                                    tasks,
                                    task.id,
                                    (e.target.value || null) as TaskQuadrant | null,
                                  ),
                                )
                              }
                              className="h-6 shrink-0 rounded bg-ink/60 px-1 font-mono text-[10px] text-faint ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                              title={t(auto ? 'matrix.autoTitle' : 'matrix.manualTitle')}
                            >
                              <option value="">{t('matrix.autoOption')}</option>
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
                      <li className="font-mono text-[10px] text-faint">
                        {t('matrix.more', { n: inQ.length - 5 })}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isPro && (
        <div className="mt-auto rounded-xl border border-accent/30 bg-accent/10 p-3.5">
          <p className="text-[12px] leading-relaxed text-cream">{t('matrix.proBox')}</p>
        </div>
      )}
    </section>
  );
}
