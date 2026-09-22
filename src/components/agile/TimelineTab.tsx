import { useMemo } from 'react';
import { ganttRows } from '../../lib/sprints';
import type { TimelineProps } from './types';
import { useI18n } from '../../lib/i18n/LocaleContext';

/** Gantt-style timeline: bars from creation to due/completion, today marker. */
export default function TimelineTab({ projectId, tasks }: TimelineProps) {
  const { t, tp, tag, fmtNum } = useI18n();
  const now = useMemo(() => Date.now(), []);
  const window = useMemo(
    () => (projectId ? ganttRows(tasks, projectId, now) : null),
    [tasks, projectId, now],
  );

  if (!projectId) {
    return (
      <div className="empty-panel">
        <p className="text-[13px] text-sage">{t('agile.tl.none')}</p>
      </div>
    );
  }
  if (!window || window.rows.length === 0) {
    return (
      <div className="empty-panel">
        <p className="text-[13px] text-sage">{t('agile.tl.empty')}</p>
      </div>
    );
  }
  const span = Math.max(1, window.windowEnd - window.windowStart);
  const todayPct = Math.min(100, Math.max(0, ((now - window.windowStart) / span) * 100));
  const overdueCount = window.rows.filter((r) => r.overdue).length;

  return (
    <div>
      <p className="font-mono text-[11px] text-faint">
        {tp('agile.tl.head', window.rows.length)}
        {overdueCount > 0 && (
          <span className="ml-2 font-bold text-tomato">
            {tp('agile.tl.overdue', overdueCount)}
          </span>
        )}
      </p>
      <div className="relative mt-2 space-y-1.5">
        <div
          className="pointer-events-none absolute bottom-0 top-0 w-px bg-accent/70"
          style={{ left: `calc(128px + (100% - 128px) * ${todayPct / 100})` }}
          title={t('cal.today')}
        />
        {window.rows.slice(0, 20).map(({ task: tsk, start, end, overdue, critical }) => {
          const left = ((start - window.windowStart) / span) * 100;
          const width = Math.max(2, ((end - start) / span) * 100);
          const done = tsk.status === 'completed';
          const range = (() => {
            try {
              const a = new Date(start).toLocaleDateString(tag);
              const b = new Date(end).toLocaleDateString(tag);
              return `${a} → ${b}${overdue ? ` ${t('agile.tl.overdueTag')}` : ''}`;
            } catch {
              return tsk.title;
            }
          })();
          return (
            <div key={tsk.id} className="flex items-center gap-2">
              <span
                className="w-[120px] shrink-0 truncate text-[11px] text-cream/80"
                title={tsk.title}
              >
                {tsk.milestone === true ? (
                  <span title={t('agile.ms')}>◆ </span>
                ) : (
                  critical && <span title={t('agile.critical')}>⛓ </span>
                )}
                {tsk.title}
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
                  title={`${tsk.title}: ${range}`}
                />
              </div>
            </div>
          );
        })}
        {window.rows.length > 20 && (
          <p className="font-mono text-[10px] text-faint">
            {t('agile.more', { n: fmtNum(window.rows.length - 20) })}
          </p>
        )}
      </div>
    </div>
  );
}
