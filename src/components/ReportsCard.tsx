import { useMemo, useState } from 'react';
import { type Session } from '../lib/store';
import type { FocusArea } from '../lib/focusAreas';
import type { Project } from '../lib/projects';
import type { Task } from '../lib/tasks';
import { fmtMinutes } from '../lib/store';
import {
  buildReport,
  paretoSplit,
  type RangeKey,
  type ReportData,
  type DayBucket,
} from '../lib/reports';
import { openPoints, pointsVelocity, etaByPoints } from '../lib/tasks';
import { billableAmount } from '../lib/projects';
import {
  exportSessionsToCSV,
  buildPrintableReportHTML,
  printReportHTML,
  type PrintableProjectRow,
  type PrintableDayRow,
} from '../lib/export';
import { isTodayInTz } from '../lib/timezone';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  history: Session[];
  areas: FocusArea[];
  projects: Project[];
  tasks: Task[];
  timezone: string;
  /** Weekly focus budget in minutes for allocation insights. */
  capacityMin: number;
}

type Breakdown = 'daily' | 'projects' | 'areas';

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`press rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
        active ? 'bg-cream/10 text-cream' : 'text-faint hover:text-sage'
      }`}
    >
      {children}
    </button>
  );
}

function DayChart({ data, timezone }: { data: DayBucket[]; timezone: string }) {
  const max = Math.max(1, ...data.map((d) => d.min));
  return (
    <div className="mt-4 flex items-end gap-1" style={{ height: 140 }}>
      {data.map((d, i) => {
        const pct = d.min === 0 ? 0 : Math.max(4, (d.min / max) * 100);
        const [y, m, dd] = d.key.split('-').map(Number);
        const date = new Date(y, m - 1, dd);
        const isToday = isTodayInTz(date.getTime(), timezone);
        const weekday = date.toLocaleDateString([], { weekday: 'narrow' });
        return (
          <div
            key={d.key}
            className="group flex flex-1 flex-col items-center gap-1"
            title={`${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${fmtMinutes(d.min)}`}
          >
            <span
              className={`font-mono text-[9px] transition-opacity ${
                isToday ? 'text-cream' : 'text-faint opacity-0 group-hover:opacity-100'
              }`}
            >
              {d.min > 0 ? fmtMinutes(d.min) : ''}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="bar-grow w-full rounded-t-sm transition-colors duration-300"
                style={{
                  height: `${pct}%`,
                  animationDelay: `${i * 30}ms`,
                  background: isToday
                    ? 'linear-gradient(180deg, var(--accent), var(--accent-deep))'
                    : d.min > 0
                      ? 'rgb(242 244 249 / 0.14)'
                      : 'rgb(242 244 249 / 0.04)',
                  boxShadow: isToday ? '0 0 12px rgb(var(--accent-rgb) / 0.4)' : 'none',
                }}
              />
            </div>
            <span
              className={`font-mono text-[9px] uppercase ${
                isToday ? 'font-bold text-cream' : 'text-faint'
              }`}
            >
              {data.length <= 8
                ? weekday
                : date.getDate() % 5 === 0 || date.getDate() === 1
                  ? date.getDate()
                  : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalBar({
  slices,
  totalMin,
  maxMin,
}: {
  slices: Array<{ name: string; color: string; min: number }>;
  totalMin: number;
  maxMin: number;
}) {
  const { t } = useI18n();
  if (slices.length === 0) {
    return (
      <p className="mt-4 text-center font-mono text-[12px] text-faint">{t('reports.noData')}</p>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      {slices.slice(0, 8).map((s, i) => {
        const pct = totalMin > 0 ? Math.round((s.min / totalMin) * 100) : 0;
        const barPct = maxMin > 0 ? (s.min / maxMin) * 100 : 0;
        return (
          <div key={s.name + i}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] text-cream/90">{s.name}</span>
              <span className="shrink-0 font-mono text-[12px] text-sage">
                {fmtMinutes(s.min)}
                <span className="ml-1 text-faint">({pct}%)</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line/50">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${barPct}%`,
                  background: s.color,
                  boxShadow: `0 0 8px ${s.color}44`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 80/20 callout: the vital few projects holding ~80% of the time. */
function ParetoNote({ slices }: { slices: Array<{ name: string; min: number }> }) {
  const { t, tp } = useI18n();
  const { top, topShare } = paretoSplit(slices);
  if (top.length === 0 || top.length >= slices.length) return null;
  return (
    <p className="mt-3 rounded-lg bg-ink/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-sage ring-1 ring-inset ring-line">
      {t('reports.pareto.prefix')}{' '}
      <span className="font-bold text-cream">{top.map((s) => s.name).join(', ')}</span>{' '}
      {tp('reports.pareto.suffix', top.length, { pct: String(Math.round(topShare * 100)) })}
    </p>
  );
}

function DonutChart({
  slices,
  totalMin,
}: {
  slices: Array<{ name: string; color: string; min: number }>;
  totalMin: number;
}) {
  const { t } = useI18n();
  if (slices.length === 0 || totalMin === 0) return null;
  const R = 36;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = slices.slice(0, 6).map((s) => {
    const pct = s.min / totalMin;
    const dash = pct * C;
    const gap = C - dash;
    const arc = { ...s, dash, gap, offset };
    offset += dash;
    return arc;
  });
  const otherMin = slices.slice(6).reduce((sum, s) => sum + s.min, 0);

  return (
    <div className="flex items-center gap-5">
      <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx="44"
            cy="44"
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth="8"
            strokeDasharray={`${a.dash} ${a.gap}`}
            strokeDashoffset={-a.offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        ))}
      </svg>
      <div className="space-y-1.5">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: a.color }} />
            <span className="text-cream/80">{a.name}</span>
            <span className="font-mono text-faint">{Math.round((a.min / totalMin) * 100)}%</span>
          </div>
        ))}
        {otherMin > 0 && (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="inline-block h-2 w-2 rounded-full bg-faint" />
            <span className="text-cream/80">{t('reports.other')}</span>
            <span className="font-mono text-faint">{Math.round((otherMin / totalMin) * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsCard({
  history,
  areas,
  projects,
  tasks,
  timezone,
  capacityMin,
}: Props) {
  const { t } = useI18n();
  const [range, setRange] = useState<RangeKey>('week');
  const [breakdown, setBreakdown] = useState<Breakdown>('daily');

  const report: ReportData = useMemo(
    () => buildReport(history, projects, areas, tasks, range, timezone),
    [history, projects, areas, tasks, range, timezone],
  );

  const { summary, days, projects: projSlices, areas: areaSlices } = report;

  const maxProjMin = projSlices.length > 0 ? projSlices[0].min : 0;
  const maxAreaMin = areaSlices.length > 0 ? areaSlices[0].min : 0;

  const eta = useMemo(() => {
    const open = openPoints(tasks);
    const vel = pointsVelocity(tasks);
    const at = etaByPoints(open, vel);
    return at !== null
      ? new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' })
      : null;
  }, [tasks]);

  const projectBarData = projSlices.map((p) => ({
    name: p.name,
    color: p.color,
    min: p.min,
  }));
  const areaBarData = areaSlices.map((a) => ({
    name: a.name,
    color: '#94a398',
    min: a.min,
  }));

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('reports.ariaLabel')}>
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('reports.title')}
          </h2>
          <p className="mt-1 text-[12px] text-faint">{t('reports.subtitle')}</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-ink/60 p-1 ring-1 ring-line">
          <Tab active={range === 'week'} onClick={() => setRange('week')}>
            {t('reports.range.week')}
          </Tab>
          <Tab active={range === 'month'} onClick={() => setRange('month')}>
            {t('reports.range.month')}
          </Tab>
        </div>
      </div>

      {/* summary strip */}
      <div className="mt-5 flex flex-wrap gap-4">
        <div>
          <div
            className="font-display text-3xl font-extrabold leading-none"
            style={{ color: 'var(--accent)' }}
          >
            {fmtMinutes(summary.totalMin)}
          </div>
          <div className="mt-1 text-[12px] text-sage">{t('reports.totalFocused')}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-[22px] font-bold text-cream">{summary.sessionCount}</div>
          <div className="mt-1 text-[12px] text-sage">{t('reports.sessions')}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[22px] font-bold text-cream">
            {fmtMinutes(summary.avgMinPerDay)}
          </div>
          <div className="mt-1 text-[12px] text-sage">{t('reports.avgPerDay')}</div>
        </div>
        {eta && (
          <div className="text-right" title={t('reports.etaTitle')}>
            <div className="font-mono text-[22px] font-bold text-cream">{eta}</div>
            <div className="mt-1 text-[12px] text-sage">{t('reports.etaLabel')}</div>
          </div>
        )}
      </div>

      {/* quick insights */}
      {(summary.topDay || summary.topProject) && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-line/60 pt-3">
          {summary.topDay && summary.topDay.min > 0 && (
            <span className="text-[12px] text-sage">
              {t('reports.bestDay')}{' '}
              <span className="font-semibold text-cream">
                {(() => {
                  const [y, m, d] = summary.topDay.key.split('-').map(Number);
                  return new Date(y, m - 1, d).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });
                })()}
              </span>{' '}
              ({fmtMinutes(summary.topDay.min)})
            </span>
          )}
          {summary.topProject && (
            <span className="text-[12px] text-sage">
              {t('reports.topProject')}{' '}
              <span className="font-semibold text-cream">{summary.topProject.name}</span> (
              {fmtMinutes(summary.topProject.min)})
            </span>
          )}
        </div>
      )}

      {/* allocation vs weekly capacity */}
      {capacityMin > 0 && summary.totalMin > 0 && (
        <div className="mt-4 border-t border-line/60 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              {t('reports.allocation')}
            </span>
            <span className="font-mono text-[11px] text-sage">
              {t('reports.allocationDetail', {
                used: fmtMinutes(summary.totalMin),
                budget: fmtMinutes(capacityMin),
                pct: String(Math.round((summary.totalMin / capacityMin) * 100)),
              })}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round((summary.totalMin / capacityMin) * 100))}%`,
                background: 'linear-gradient(90deg, var(--accent-deep), var(--accent))',
              }}
            />
          </div>
          <p className="mt-1.5 text-[12px] text-sage">
            {t('reports.topShare')}{' '}
            <span className="font-semibold text-cream">
              {projectBarData.length > 0
                ? t('reports.topShareWithProject', {
                    name: projectBarData[0].name,
                    pct: String(Math.round((projectBarData[0].min / summary.totalMin) * 100)),
                  })
                : '—'}
            </span>{' '}
            {t('reports.topShareTune')}
          </p>
        </div>
      )}

      {/* breakdown tabs */}
      <div className="mt-5 flex gap-1 rounded-xl bg-ink/60 p-1 ring-1 ring-line w-fit">
        <Tab active={breakdown === 'daily'} onClick={() => setBreakdown('daily')}>
          {t('reports.breakdown.daily')}
        </Tab>
        <Tab active={breakdown === 'projects'} onClick={() => setBreakdown('projects')}>
          {t('reports.breakdown.projects')}
        </Tab>
        <Tab active={breakdown === 'areas'} onClick={() => setBreakdown('areas')}>
          {t('reports.breakdown.areas')}
        </Tab>
      </div>

      {/* charts */}
      {breakdown === 'daily' && (
        <div className="mt-2">
          <DayChart data={days} timezone={timezone} />
        </div>
      )}

      {breakdown === 'projects' && (
        <div className="mt-2 flex flex-wrap gap-6">
          <div className="min-w-0 flex-1">
            <HorizontalBar
              slices={projectBarData}
              totalMin={summary.totalMin}
              maxMin={maxProjMin}
            />
          </div>
          <div className="flex items-center justify-center">
            <DonutChart slices={projectBarData} totalMin={summary.totalMin} />
          </div>
        </div>
      )}
      {breakdown === 'projects' && projectBarData.length > 1 && (
        <ParetoNote slices={projectBarData} />
      )}

      {breakdown === 'areas' && (
        <div className="mt-2">
          <HorizontalBar slices={areaBarData} totalMin={summary.totalMin} maxMin={maxAreaMin} />
        </div>
      )}

      {/* export */}
      <div className="mt-6 flex flex-wrap gap-2 border-t border-line/60 pt-4">
        <button
          onClick={() => exportSessionsToCSV(history, projects, areas, tasks)}
          className="press btn-ghost rounded-lg px-4 py-2 font-mono text-[12px] font-semibold"
        >
          {t('reports.exportCsv')}
        </button>
        <button
          onClick={() => {
            const byId = new Map(projects.map((p) => [p.id, p]));
            const rows: PrintableProjectRow[] = projSlices.map((s) => {
              const p = byId.get(s.projectId);
              return {
                name: s.name,
                color: s.color,
                min: s.min,
                amount: p ? billableAmount(p, s.min) : 0,
              };
            });
            const dayRows: PrintableDayRow[] = days
              .filter((d) => d.min > 0)
              .map((d) => {
                const [y, m, dd] = d.key.split('-').map(Number);
                return {
                  label: new Date(y, m - 1, dd).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  }),
                  min: d.min,
                };
              });
            printReportHTML(
              buildPrintableReportHTML({
                title: t('reports.printTitle'),
                rangeLabel:
                  range === 'week' ? t('reports.printRangeWeek') : t('reports.printRangeMonth'),
                generatedAt: new Date().toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }),
                totalMin: summary.totalMin,
                sessionCount: summary.sessionCount,
                avgMinPerDay: summary.avgMinPerDay,
                totalBillable: rows.reduce((sum, r) => sum + r.amount, 0),
                projects: rows,
                days: dayRows,
              }),
            );
          }}
          className="press btn-ghost rounded-lg px-4 py-2 font-mono text-[12px] font-semibold"
          title={t('reports.exportPdfTitle')}
        >
          {t('reports.exportPdf')}
        </button>
      </div>
    </section>
  );
}
