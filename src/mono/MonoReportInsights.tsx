import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import MonoCard from './MonoCard';
import MonoRing from './MonoRing';
import { buildReportInsights, type HabitStrength, type WeekTotal } from '../lib/reportInsights';
import { localDayKey } from '../lib/projects';
import type { Habit, HabitLog } from '../lib/habits';
import type { Session } from '../lib/store';
import type { EnergyEntry } from '../lib/energy';
import type { Task } from '../lib/tasks';
import { estimateAccuracy } from '../lib/estimates';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  habits: Habit[];
  habitLog: HabitLog;
  history: Session[];
  energyLog: EnergyEntry[];
  timezone: string;
  isPro: boolean;
  /** Enables the Pro estimate-accuracy line. */
  tasks?: Task[];
  now?: number;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mono-ins-card">
      <MonoCard style={{ height: '100%' }}>
        <p className="mono-eyebrow" style={{ marginBottom: 10 }}>
          {title}
        </p>
        {children}
      </MonoCard>
    </div>
  );
}

function WeeksChart({ weeks, best, worst }: { weeks: WeekTotal[]; best: string; worst: string }) {
  const { t, fmtDayKey, fmtDur } = useI18n();
  const max = Math.max(1, ...weeks.map((w) => w.min));
  const w = 18;
  const gap = 8;
  const h = 64;
  const alt = `${t('rep.ins.weeksAria', { n: weeks.length })}: ${weeks
    .map((x) => `${fmtDayKey(x.mondayKey)} ${fmtDur(x.min)}`)
    .join(', ')}`;
  return (
    <svg
      className="mono-histo"
      viewBox={`0 0 ${weeks.length * (w + gap) - gap} ${h}`}
      role="img"
      aria-label={alt}
      preserveAspectRatio="none"
    >
      {weeks.map((x, i) => {
        const bh = x.min > 0 ? Math.max(3, (x.min / max) * h) : 0;
        const cls =
          x.mondayKey === best ? 'is-best' : x.mondayKey === worst ? 'is-worst' : undefined;
        return (
          <g key={x.mondayKey}>
            <rect
              className="mono-histo-track"
              x={i * (w + gap)}
              y={0}
              width={w}
              height={h}
              rx={3}
            />
            <rect
              className={cls ? `mono-histo-bar ${cls}` : 'mono-histo-bar'}
              x={i * (w + gap)}
              y={h - bh}
              width={w}
              height={bh}
              rx={3}
            />
          </g>
        );
      })}
    </svg>
  );
}

function HoursChart({ hours, best }: { hours: number[]; best: number }) {
  const { t, fmtClock, fmtDur } = useI18n();
  const max = Math.max(1, ...hours);
  const w = 8;
  const gap = 3;
  const h = 56;
  const alt = `${t('rep.ins.histoAria')}: ${hours
    .map((m, hr) => (m > 0 ? `${fmtClock(hr * 60)} ${fmtDur(m)}` : null))
    .filter(Boolean)
    .join(', ')}`;
  return (
    <svg
      className="mono-histo"
      viewBox={`0 0 ${24 * (w + gap) - gap} ${h}`}
      role="img"
      aria-label={alt}
      preserveAspectRatio="none"
    >
      {hours.map((m, hr) => {
        const bh = m > 0 ? Math.max(2, (m / max) * h) : 0;
        return (
          <g key={hr}>
            <rect
              className="mono-histo-track"
              x={hr * (w + gap)}
              y={0}
              width={w}
              height={h}
              rx={2}
            />
            <rect
              className={hr === best ? 'mono-histo-bar is-best' : 'mono-histo-bar'}
              x={hr * (w + gap)}
              y={h - bh}
              width={w}
              height={bh}
              rx={2}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** "What your data says" block at the top of Reports. Free sees card 1. */
export default function MonoReportInsights({
  habits,
  habitLog,
  history,
  energyLog,
  timezone,
  isPro,
  tasks,
  now = Date.now(),
}: Props) {
  const { t, tp, fmtNum, fmtDur, fmtDayKey, fmtClock } = useI18n();
  const accuracy = useMemo(
    () => (isPro && tasks ? estimateAccuracy(tasks, history) : null),
    [isPro, tasks, history],
  );
  const ins = useMemo(
    () =>
      buildReportInsights({
        habits,
        habitLog,
        history,
        energyLog,
        timezone,
        now,
        habitTodayKey: localDayKey(now),
      }),
    [habits, habitLog, history, energyLog, timezone, now],
  );
  const needData = <p className="mono-meta">{t('rep.ins.needData')}</p>;
  const dash = '—';

  const habitBody = (h: HabitStrength | null, hint?: string) => {
    if (!h) return needData;
    const pct = Math.round(h.rate * 100);
    return (
      <div className="mono-ins-habit">
        <MonoRing
          value={pct}
          size={52}
          stroke={6}
          label={t('rep.ins.habitRing', { name: h.name, pct: fmtNum(pct) })}
        >
          <span className="mono-week-pct">{fmtNum(pct)}</span>
        </MonoRing>
        <div className="mono-list-grow">
          <div className="mono-h3">{h.name}</div>
          <p className="mono-meta">
            {t('rep.ins.habitDays', { hits: fmtNum(h.hits), days: fmtNum(h.eligibleDays) })}
          </p>
          {hint ? (
            <p className="mono-meta" style={{ marginTop: 3 }}>
              {hint}
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  const strong = (
    <Card key="strong" title={t('rep.ins.strong')}>
      {habitBody(ins.strongest)}
    </Card>
  );

  const locked = [
    <Card key="weak" title={t('rep.ins.weak')}>
      {habitBody(ins.weakest, t('rep.ins.weakHint'))}
    </Card>,
    <Card key="weeks" title={t('rep.ins.weeks')}>
      {ins.bestWorst ? (
        <>
          <p className="mono-meta">
            {t('rep.ins.bestWeek', {
              date: fmtDayKey(ins.bestWorst.best.mondayKey),
              dur: fmtDur(ins.bestWorst.best.min),
            })}
          </p>
          <p className="mono-meta" style={{ marginTop: 3, marginBottom: 10 }}>
            {t('rep.ins.worstWeek', {
              date: fmtDayKey(ins.bestWorst.worst.mondayKey),
              dur: fmtDur(ins.bestWorst.worst.min),
            })}
          </p>
          <WeeksChart
            weeks={ins.weeks}
            best={ins.bestWorst.best.mondayKey}
            worst={ins.bestWorst.worst.mondayKey}
          />
        </>
      ) : (
        needData
      )}
    </Card>,
    <Card key="hour" title={t('rep.ins.hour')}>
      {ins.bestHour ? (
        <>
          <p className="mono-h3" style={{ marginBottom: 10 }}>
            {t('rep.ins.hourValue', {
              from: fmtClock(ins.bestHour.hour * 60),
              to: fmtClock(((ins.bestHour.hour + 1) % 24) * 60),
              pct: fmtNum(Math.round(ins.bestHour.share * 100)),
            })}
          </p>
          <HoursChart hours={ins.hours} best={ins.bestHour.hour} />
        </>
      ) : (
        needData
      )}
    </Card>,
    <Card key="energy" title={t('rep.ins.energy')}>
      {ins.energy ? (
        <>
          <p className="mono-meta">
            {t('rep.ins.energyValue', {
              high: ins.energy.highAvgMin === null ? dash : fmtDur(ins.energy.highAvgMin),
              low: ins.energy.lowAvgMin === null ? dash : fmtDur(ins.energy.lowAvgMin),
            })}
          </p>
          {ins.energy.moodHighAvgMin !== null || ins.energy.moodLowAvgMin !== null ? (
            <p className="mono-meta" style={{ marginTop: 3 }}>
              {t('rep.ins.moodValue', {
                high: ins.energy.moodHighAvgMin === null ? dash : fmtDur(ins.energy.moodHighAvgMin),
                low: ins.energy.moodLowAvgMin === null ? dash : fmtDur(ins.energy.moodLowAvgMin),
              })}
            </p>
          ) : null}
        </>
      ) : (
        needData
      )}
    </Card>,
  ];

  return (
    <section className="mono-ins" aria-label={t('rep.ins.title')} data-testid="report-insights">
      <p className="mono-eyebrow" style={{ marginBottom: 8 }}>
        {t('rep.ins.title')}
      </p>
      <div className="mono-ins-grid">
        {strong}
        {isPro
          ? locked
          : ins.lockedWithData > 0 && (
              <div className="mono-ins-card">
                <MonoCard style={{ height: '100%' }}>
                  <p className="mono-h3" style={{ marginBottom: 10 }}>
                    {tp('rep.ins.proMore', ins.lockedWithData)}
                  </p>
                  <Link to="/pricing" className="mono-btn mono-btn-ghost">
                    {t('rep.ins.proCta')}
                  </Link>
                </MonoCard>
              </div>
            )}
      </div>
      {accuracy ? (
        <p className="mono-meta" style={{ marginTop: 10 }} data-testid="estimate-accuracy">
          {t('rep.ins.estimates', { pct: fmtNum(accuracy.pct) })}
        </p>
      ) : null}
    </section>
  );
}
