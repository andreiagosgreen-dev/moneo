import { useMemo } from 'react';
import { ganttRows, ganttDayLines } from '../../lib/sprints';
import { subtasksOf } from '../../lib/tasks';
import { useI18n } from '../../lib/i18n/LocaleContext';
import type { TKey } from '../../lib/i18n/types';
import type { TimelineProps } from './types';

/** Fixed row height (px) — required so the SVG dependency-arrow overlay can
 *  address each row by index without measuring the DOM. */
const ROW_H = 28;
/** Label column (120px) + gap-2 (8px) — the left edge of the date track. */
const TRACK_LEFT = 128;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_SHORT_KEYS: TKey[] = [
  'calendar.weekdayShort.sun',
  'calendar.weekdayShort.mon',
  'calendar.weekdayShort.tue',
  'calendar.weekdayShort.wed',
  'calendar.weekdayShort.thu',
  'calendar.weekdayShort.fri',
  'calendar.weekdayShort.sat',
];

interface DepArrow {
  key: string;
  d: string;
}

/**
 * Gantt-style timeline: bars from creation to due/completion, a week-start
 * ruler, weekend shading, a today marker, read-only dependency arrows
 * (from `Task.blockedBy`), and a percent-complete strip for tasks that have
 * subtasks. Read-only — no drag/resize/edit, no zoom controls (out of scope
 * for this pass, see plan Faza 11).
 */
export default function TimelineTab({ projectId, tasks }: TimelineProps) {
  const { t, tp } = useI18n();
  const now = useMemo(() => Date.now(), []);
  const win = useMemo(
    () => (projectId ? ganttRows(tasks, projectId, now) : null),
    [tasks, projectId, now],
  );
  const dayLines = useMemo(() => (win ? ganttDayLines(win.windowStart, win.windowEnd) : []), [win]);

  const completion = useMemo(() => {
    const map = new Map<string, number>();
    if (!win) return map;
    for (const row of win.rows) {
      const subs = subtasksOf(tasks, row.task.id);
      if (subs.length > 0) {
        map.set(row.task.id, subs.filter((s) => s.status === 'completed').length / subs.length);
      }
    }
    return map;
  }, [win, tasks]);

  const arrows = useMemo((): DepArrow[] => {
    if (!win) return [];
    const span = Math.max(1, win.windowEnd - win.windowStart);
    const out: DepArrow[] = [];
    win.rows.forEach((row, depIdx) => {
      for (const predId of row.task.blockedBy ?? []) {
        const predIdx = win.rows.findIndex((r) => r.task.id === predId);
        if (predIdx === -1 || predIdx === depIdx) continue;
        const pred = win.rows[predIdx];
        const x1 = ((pred.end - win.windowStart) / span) * 1000;
        const y1 = predIdx * ROW_H + ROW_H / 2;
        const x2 = ((row.start - win.windowStart) / span) * 1000;
        const y2 = depIdx * ROW_H + ROW_H / 2;
        const mid = (x1 + x2) / 2;
        out.push({
          key: `${predId}->${row.task.id}`,
          d: `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`,
        });
      }
    });
    return out;
  }, [win]);

  if (!projectId) {
    return (
      <p className="rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] text-faint">
        {t('agile.timeline.projectRequired')}
      </p>
    );
  }
  if (!win || win.rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] text-faint">
        {t('agile.timeline.empty')}
      </p>
    );
  }

  const span = Math.max(1, win.windowEnd - win.windowStart);
  const pct = (ms: number) => ((ms - win.windowStart) / span) * 100;
  const todayPct = Math.min(100, Math.max(0, pct(now)));
  const overdueCount = win.rows.filter((r) => r.overdue).length;
  const rows = win.rows;

  return (
    <div>
      <p className="font-mono text-[11px] text-faint">
        {tp('agile.timeline.taskCount', rows.length)} · {t('agile.timeline.window')}
        {overdueCount > 0 && (
          <span className="ml-2 font-bold text-tomato">
            {tp('agile.timeline.overdueCount', overdueCount)}
          </span>
        )}
      </p>

      <div className="relative mt-2 overflow-hidden rounded-lg bg-ink/30 ring-1 ring-inset ring-line/50">
        {/* ruler header — week-start labels, pinned above the scroll area */}
        <div className="relative h-5 border-b border-line/40 bg-ink/40">
          <div
            className="pointer-events-none absolute inset-y-0 overflow-hidden"
            style={{ left: TRACK_LEFT, right: 0 }}
          >
            {dayLines
              .filter((d) => d.isWeekStart && d.at >= win.windowStart)
              .map((d) => (
                <span
                  key={d.at}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[9px] text-faint"
                  style={{ left: `${pct(d.at)}%` }}
                >
                  {t(WEEKDAY_SHORT_KEYS[d.dow])} {new Date(d.at).getDate()}
                </span>
              ))}
          </div>
        </div>

        {/* scrollable rows — every task in the window, no cutoff */}
        <div className="nice-scroll max-h-[420px] overflow-y-auto overflow-x-hidden">
          <div className="relative" style={{ height: rows.length * ROW_H }}>
            {/* background: weekend shading, day gridlines, today marker */}
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden"
              style={{ left: TRACK_LEFT, right: 0 }}
            >
              {dayLines
                .filter((d) => d.isWeekend)
                .map((d) => {
                  const bandLeft = Math.max(win.windowStart, d.at);
                  const bandRight = Math.min(win.windowEnd, d.at + DAY_MS);
                  const widthPct = Math.max(0, ((bandRight - bandLeft) / span) * 100);
                  if (widthPct <= 0) return null;
                  return (
                    <div
                      key={`we-${d.at}`}
                      className="absolute inset-y-0 bg-cream/[0.03]"
                      style={{ left: `${pct(bandLeft)}%`, width: `${widthPct}%` }}
                    />
                  );
                })}
              {dayLines
                .filter((d) => d.at >= win.windowStart)
                .map((d) => (
                  <div
                    key={`gl-${d.at}`}
                    className="absolute inset-y-0 w-px bg-line/15"
                    style={{ left: `${pct(d.at)}%` }}
                  />
                ))}
              <div
                className="absolute inset-y-0 w-px bg-accent/70"
                style={{ left: `${todayPct}%` }}
                title={t('agile.timeline.today')}
              />
            </div>

            {/* dependency arrows (read-only), from Task.blockedBy */}
            {arrows.length > 0 && (
              <svg
                className="pointer-events-none absolute inset-y-0"
                style={{ left: TRACK_LEFT, right: 0 }}
                width="100%"
                height="100%"
                viewBox={`0 0 1000 ${rows.length * ROW_H}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <marker
                    id="gantt-arrow"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="rgb(242 244 249 / 0.45)" />
                  </marker>
                </defs>
                {arrows.map((a) => (
                  <path
                    key={a.key}
                    d={a.d}
                    fill="none"
                    stroke="rgb(242 244 249 / 0.35)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                    markerEnd="url(#gantt-arrow)"
                  />
                ))}
              </svg>
            )}

            {/* rows */}
            {rows.map(({ task: rt, start, end, overdue, critical }, i) => {
              const left = pct(start);
              const width = Math.max(2, ((end - start) / span) * 100);
              const visibleWidth = Math.min(100 - left, width);
              const done = rt.status === 'completed';
              const rowCompletion = completion.get(rt.id);
              return (
                <div
                  key={rt.id}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ top: i * ROW_H, height: ROW_H }}
                >
                  <span
                    className="w-[120px] shrink-0 truncate text-[11px] text-cream/80"
                    title={rt.title}
                  >
                    {rt.milestone === true ? (
                      <span title={t('agile.timeline.milestone')}>◆ </span>
                    ) : (
                      critical && <span title={t('agile.timeline.criticalPath')}>⛓ </span>
                    )}
                    {rt.title}
                  </span>
                  <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded bg-ink/60 ring-1 ring-inset ring-line/50">
                    <div
                      className="absolute top-0 h-full rounded"
                      style={{
                        left: `${left}%`,
                        width: `${visibleWidth}%`,
                        background: done
                          ? 'rgb(148 163 152 / 0.5)'
                          : overdue
                            ? 'var(--tomato, #e5484d)'
                            : critical
                              ? 'var(--accent)'
                              : 'rgb(242 244 249 / 0.28)',
                      }}
                      title={`${rt.title}: ${new Date(start).toLocaleDateString()} → ${new Date(end).toLocaleDateString()}${overdue ? t('agile.timeline.overdueSuffix') : ''}`}
                    />
                    {rowCompletion != null && (
                      <div
                        className="absolute bottom-0 h-[3px] rounded-b bg-cream/60"
                        style={{ left: `${left}%`, width: `${visibleWidth * rowCompletion}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
