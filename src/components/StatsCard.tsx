import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtMinutes, type Session, type Settings } from '../lib/store';
import { getWeeklyTopIntentions } from '../lib/intentions';
import {
  activeAreas,
  getWeeklyAreaSummary,
  resolveAreaName,
  type FocusArea,
} from '../lib/focusAreas';
import {
  currentStreakInTz,
  isTodayInTz,
  minutesForDayKey,
  trailingWeekDayKeysInTz,
} from '../lib/timezone';
import SessionLog from './SessionLog';
import type { Project } from '../lib/projects';
import { activeProjects } from '../lib/projects';
import { createManualSession } from '../lib/sessions';

interface Props {
  history: Session[];
  settings: Settings;
  areas: FocusArea[];
  projects: Project[];
  /** Effective IANA timezone (account tz when signed in, else browser). */
  timezone: string;
  /** True once cloud sync is initialized — local clearing is then locked. */
  clearDisabled?: boolean;
  onClear: () => void;
  onHistoryAdd: (session: Session) => void;
}

function FlameIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2c.6 3.4-.8 5-2.3 6.6C8 10.4 6.5 12.1 6.5 15a5.5 5.5 0 0 0 11 0c0-1.9-.8-3.4-1.6-4.7-.4 1-1 1.7-1.9 2.2.3-2.8-.6-6.6-2-8.5z" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}

export default function StatsCard({
  history,
  settings,
  areas,
  projects,
  timezone,
  clearDisabled,
  onClear,
  onHistoryAdd,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualMin, setManualMin] = useState('25');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualProject, setManualProject] = useState('');
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const today = useMemo(
    () => history.filter((s) => isTodayInTz(s.at, timezone)).sort((a, b) => b.at - a.at),
    [history, timezone],
  );
  const minutesToday = today.reduce((sum, s) => sum + s.min, 0);
  const goalPct = Math.min(100, Math.round((today.length / settings.dailyGoal) * 100));
  const streak = useMemo(() => currentStreakInTz(history, timezone), [history, timezone]);

  const week = useMemo(() => {
    const keys = trailingWeekDayKeysInTz(7, timezone);
    const rows = keys.map((key) => {
      const [y, m, d] = key.split('-').map(Number);
      return {
        day: new Date(y, m - 1, d),
        min: minutesForDayKey(history, key, timezone),
      };
    });
    const max = Math.max(1, ...rows.map((r) => r.min));
    return { rows, max };
  }, [history, timezone]);

  // Derived once per history/areas change — never on countdown ticks.
  const topIntentions = useMemo(
    () => getWeeklyTopIntentions(history, 3, timezone),
    [history, timezone],
  );
  const liveAreas = useMemo(() => activeAreas(areas), [areas]);
  const areaRows = useMemo(
    () => getWeeklyAreaSummary(history, timezone).slice(0, 3),
    [history, timezone],
  );

  const askClear = () => {
    if (!confirming) {
      setConfirming(true);
      timer.current = window.setTimeout(() => setConfirming(false), 2600);
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    setConfirming(false);
    onClear();
  };

  const manualProjects = useMemo(() => activeProjects(projects), [projects]);

  const addManual = () => {
    const at = manualDate ? new Date(manualDate + 'T12:00:00').getTime() : Date.now();
    const session = createManualSession({
      minutes: Number(manualMin),
      at,
      ...(manualProject ? { projectId: manualProject } : {}),
    });
    if (!session) return;
    onHistoryAdd(session);
    setManualMin('25');
    setShowManual(false);
  };

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="Today's focus statistics">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-cream">Today</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          {new Date().toLocaleDateString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </header>

      {/* headline numbers */}
      <div className="mt-5 flex items-end gap-5">
        <div>
          <div
            className="font-display text-6xl font-extrabold leading-none tracking-tight"
            style={{ color: 'var(--accent)' }}
          >
            {today.length}
          </div>
          <div className="mt-1.5 text-[13px] text-sage">of {settings.dailyGoal} sessions</div>
        </div>
        <div className="mb-0.5 ml-auto flex flex-col items-end gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-ink/60 py-1.5 pl-2.5 pr-3 font-mono text-[13px] text-cream ring-1 ring-inset ring-line">
            <span className="text-sage">
              <ClockIcon />
            </span>
            {fmtMinutes(minutesToday)} focused
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-ink/60 py-1.5 pl-2.5 pr-3 font-mono text-[13px] text-cream ring-1 ring-inset ring-line">
            <span className="text-tomato">
              <FlameIcon />
            </span>
            {streak}-day streak
          </span>
        </div>
      </div>

      {/* goal progress */}
      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${goalPct}%`,
              background: 'linear-gradient(90deg, var(--accent-deep), var(--accent))',
              boxShadow: '0 0 12px rgb(var(--accent-rgb) / 0.6)',
            }}
          />
        </div>
        <p className="mt-1.5 text-[12px] text-faint">
          {today.length >= settings.dailyGoal
            ? 'Daily goal reached — anything more is extra credit.'
            : `${settings.dailyGoal - today.length} to go for today's goal`}
        </p>
      </div>

      {/* 7-day chart */}
      <div className="mt-6">
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          Last 7 days
        </h3>
        <div className="mt-3 flex h-24 items-end gap-2">
          {week.rows.map(({ day, min }, i) => {
            const isNow = isTodayInTz(day.getTime(), timezone);
            const h = min === 0 ? 4 : Math.max(10, (min / week.max) * 100);
            return (
              <div
                key={day.toISOString()}
                className="group flex flex-1 flex-col items-center gap-1.5"
                title={`${fmtMinutes(min)} focused`}
              >
                <span
                  className={`font-mono text-[10px] transition-opacity ${isNow ? 'text-cream' : 'text-faint opacity-0 group-hover:opacity-100'}`}
                >
                  {min > 0 ? fmtMinutes(min) : '—'}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="bar-grow w-full rounded-md transition-colors duration-300"
                    style={{
                      height: `${h}%`,
                      animationDelay: `${i * 60}ms`,
                      background: isNow
                        ? 'linear-gradient(180deg, var(--accent), var(--accent-deep))'
                        : min > 0
                          ? 'rgb(242 244 249 / 0.16)'
                          : 'rgb(242 244 249 / 0.06)',
                      boxShadow: isNow ? '0 0 14px rgb(var(--accent-rgb) / 0.45)' : 'none',
                    }}
                  />
                </div>
                <span
                  className={`font-mono text-[10px] uppercase ${isNow ? 'font-bold text-cream' : 'text-faint'}`}
                >
                  {day.toLocaleDateString([], { weekday: 'narrow' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* weekly insights — derived, compact, never per-tick */}
      {(topIntentions.length > 0 || areaRows.length > 0) && (
        <div className="mt-6 border-t border-line pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {topIntentions.length > 0 && (
              <div>
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
                  Top focus · week
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {topIntentions.map((g) => (
                    <li key={g.key} className="flex items-baseline gap-3 text-[13px]">
                      <span className="min-w-0 truncate text-cream/90">{g.label}</span>
                      <span className="ml-auto shrink-0 font-mono text-[12px] text-sage">
                        {fmtMinutes(g.min)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {areaRows.length > 0 && (
              <div>
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
                  By area · week
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {areaRows.map((r) => (
                    <li key={r.areaId} className="flex items-baseline gap-3 text-[13px]">
                      <span className="min-w-0 truncate text-cream/90">
                        {resolveAreaName(liveAreas, r.areaId) ?? 'Deleted area'}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-[12px] text-sage">
                        {fmtMinutes(r.min)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* today's log */}
      <div className="mt-6 border-t border-line pt-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            Session log
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowManual(!showManual)}
              className="press rounded-md px-2 py-1 font-mono text-[11px] text-sage hover:text-cream"
              title="Log time worked without the timer (meetings, offline work)"
            >
              {showManual ? 'Cancel' : '+ Log time'}
            </button>
            {clearDisabled ? (
              <span
                className="rounded-md px-2 py-1 font-mono text-[11px] text-faint"
                title="Signed-in history is managed through your account"
              >
                Protected by sync
              </span>
            ) : (
              history.length > 0 && (
                <button
                  onClick={askClear}
                  className={`press rounded-md px-2 py-1 font-mono text-[11px] ${
                    confirming
                      ? 'bg-tomato/15 font-bold text-tomato ring-1 ring-tomato/40'
                      : 'text-faint hover:text-sage'
                  }`}
                >
                  {confirming ? 'Tap again to confirm' : 'Clear all'}
                </button>
              )
            )}
          </div>
        </div>
        {showManual && (
          <div className="mt-2.5 space-y-2 rounded-xl border border-line bg-ink/60 p-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                max={480}
                value={manualMin}
                onChange={(e) => setManualMin(e.target.value)}
                className="h-9 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title="Minutes (1–480)"
                placeholder="Minutes"
              />
              <input
                type="date"
                value={manualDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setManualDate(e.target.value)}
                className="h-9 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title="Work date"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={manualProject}
                onChange={(e) => setManualProject(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title="Project (optional)"
              >
                <option value="">No project</option>
                {manualProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={addManual}
                disabled={Number(manualMin) < 1}
                className="press btn-accent h-9 shrink-0 rounded-lg px-4 text-sm font-semibold disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        )}
        <SessionLog sessions={today} resolveAreaName={(id) => resolveAreaName(liveAreas, id)} />
      </div>
    </section>
  );
}
