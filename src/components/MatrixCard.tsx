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

export default function MatrixCard({ tasks, history, onTasksChange, isPro = false }: Props) {
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
    <section className="card px-6 py-6 sm:px-7" aria-label={t('matrix.aria')}>
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('matrix.title')}
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {t(isPro ? 'matrix.subPro' : 'matrix.subFree')}
          </p>
        </div>
        <span className="font-mono text-[11px] text-sage">
          {t('matrix.active', { n: fmtNum(total) })}
        </span>
      </header>

      {focus && focus.quadrant && (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">
          <p className="text-[13px] font-semibold text-cream">
            {t(QUADRANT_TEXT_KEYS[focus.quadrant].action as TKey)}: {focus.task?.title}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-faint">{focus.headline}</p>
        </div>
      )}

      {total === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] leading-relaxed text-faint">
          {t('matrix.empty')}
        </p>
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
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
          <p className="text-[12px] leading-relaxed text-cream">{t('matrix.proBox')}</p>
        </div>
      )}
    </section>
  );
}
