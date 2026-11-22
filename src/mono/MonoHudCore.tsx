import { useMemo } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { Session } from '../lib/store';
import type { MonoTab } from './MonoNav';

const DAY_MS = 86_400_000;

export interface HudInput {
  focusMinToday: number;
  focusGoalMin: number;
  tasksDone: number;
  tasksTotal: number;
  workoutsThisWeek: number;
  workoutsGoal: number;
  habitsDoneToday: number;
  habitsTotalToday: number;
  history: Session[];
  now?: number;
}

export interface HudMetrics {
  mindPct: number;
  execPct: number;
  bodyPct: number;
  score: number;
  /** 14 daily focus totals (oldest → today). */
  daily14: number[];
  thisWeekMin: number;
  prevWeekMin: number;
  deltaPct: number | null;
}

const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Pure telemetry calculator for the 3-ring Personal OS HUD and 14-day evolution curve. */
export function computeHudMetrics(input: HudInput): HudMetrics {
  const now = input.now ?? Date.now();
  const focusGoal = Math.max(15, input.focusGoalMin || 100);
  const mindPct = clampPct((Math.max(0, input.focusMinToday) / focusGoal) * 100);
  const execPct =
    input.tasksTotal > 0 ? clampPct((Math.max(0, input.tasksDone) / input.tasksTotal) * 100) : 0;

  const workoutGoal = Math.max(1, input.workoutsGoal || 3);
  const workoutRatio = Math.min(1, Math.max(0, input.workoutsThisWeek) / workoutGoal);
  const habitRatio =
    input.habitsTotalToday > 0
      ? Math.min(1, Math.max(0, input.habitsDoneToday) / input.habitsTotalToday)
      : workoutRatio;
  const bodyPct = clampPct(((workoutRatio + habitRatio) / 2) * 100);

  const score = clampPct(mindPct * 0.4 + execPct * 0.35 + bodyPct * 0.25);

  // Bucket last 14 days (rolling 24h windows anchored at `now`)
  const daily14 = Array.from({ length: 14 }, () => 0);
  const startWindow = now - 14 * DAY_MS;
  for (const s of input.history) {
    if (s.at < startWindow || s.at > now + DAY_MS) continue;
    const daysAgo = Math.floor((now - s.at) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < 14) {
      daily14[13 - daysAgo] += Math.max(0, s.min);
    }
  }
  const prevWeekMin = daily14.slice(0, 7).reduce((a, b) => a + b, 0);
  const thisWeekMin = daily14.slice(7).reduce((a, b) => a + b, 0);
  const deltaPct =
    prevWeekMin > 0
      ? Math.round(((thisWeekMin - prevWeekMin) / prevWeekMin) * 100)
      : thisWeekMin > 0
        ? 100
        : null;

  return { mindPct, execPct, bodyPct, score, daily14, thisWeekMin, prevWeekMin, deltaPct };
}

function sparklinePaths(values: number[], w: number, h: number): { line: string; area: string } {
  const max = Math.max(25, ...values);
  const padY = 6;
  const usableH = h - padY * 2;
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => {
    const x = Number((i * stepX).toFixed(1));
    const y = Number((h - padY - (v / max) * usableH).toFixed(1));
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return { line, area };
}

const R_OUTER = 82;
const R_MID = 66;
const R_INNER = 50;
const C_OUTER = 2 * Math.PI * R_OUTER;
const C_MID = 2 * Math.PI * R_MID;
const C_INNER = 2 * Math.PI * R_INNER;
const HUD_TICKS = Array.from({ length: 36 }, (_, i) => i * 10);

interface Props extends HudInput {
  onGo?: (tab: MonoTab) => void;
}

/**
 * J.A.R.V.I.S.-inspired Personal OS HUD:
 * 3 concentric glowing telemetry rings (Mind · Execution · Body) + 14-day evolution sparkline.
 */
export default function MonoHudCore(props: Props) {
  const { onGo } = props;
  const { t, fmtNum, fmtDur } = useI18n();

  const m = useMemo(
    () =>
      computeHudMetrics({
        focusMinToday: props.focusMinToday,
        focusGoalMin: props.focusGoalMin,
        tasksDone: props.tasksDone,
        tasksTotal: props.tasksTotal,
        workoutsThisWeek: props.workoutsThisWeek,
        workoutsGoal: props.workoutsGoal,
        habitsDoneToday: props.habitsDoneToday,
        habitsTotalToday: props.habitsTotalToday,
        history: props.history,
        now: props.now,
      }),
    [
      props.focusMinToday,
      props.focusGoalMin,
      props.tasksDone,
      props.tasksTotal,
      props.workoutsThisWeek,
      props.workoutsGoal,
      props.habitsDoneToday,
      props.habitsTotalToday,
      props.history,
      props.now,
    ],
  );

  const spark = useMemo(() => sparklinePaths(m.daily14, 280, 68), [m.daily14]);
  const dash = (c: number, pct: number) => Number((c * (1 - Math.max(0.04, pct / 100))).toFixed(2));

  const channels: Array<{
    id: 'mind' | 'exec' | 'body';
    tab: MonoTab;
    label: string;
    pct: number;
    meta: string;
  }> = [
    {
      id: 'mind',
      tab: 'focus',
      label: t('mono.nav.focus'),
      pct: m.mindPct,
      meta: fmtDur(props.focusMinToday),
    },
    {
      id: 'exec',
      tab: 'today',
      label: t('mono.nav.azi'),
      pct: m.execPct,
      meta: `${fmtNum(props.tasksDone)}/${fmtNum(props.tasksTotal)}`,
    },
    {
      id: 'body',
      tab: 'move',
      label: t('nav.move'),
      pct: m.bodyPct,
      meta: `${fmtNum(props.workoutsThisWeek)}/${fmtNum(Math.max(1, props.workoutsGoal))}`,
    },
  ];

  return (
    <section className="mono-hud" aria-label={t('growth.title')}>
      <div className="mono-hud-dial" role="img" aria-label={`${t('growth.title')}: ${m.score}%`}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <linearGradient id="hud-grad-mind" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f5b971" />
              <stop offset="100%" stopColor="var(--mono-tint)" />
            </linearGradient>
            <linearGradient id="hud-grad-exec" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="hud-grad-body" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          <g className="mono-hud-reticle">
            <circle cx="100" cy="100" r="95" className="mono-hud-orbit" />
            {HUD_TICKS.map((deg) => (
              <line
                key={deg}
                x1="100"
                y1="2"
                x2="100"
                y2={deg % 90 === 0 ? '8' : '5'}
                transform={`rotate(${deg} 100 100)`}
              />
            ))}
          </g>

          <circle className="mono-hud-track" cx="100" cy="100" r={R_OUTER} strokeWidth="7" />
          <circle
            className="mono-hud-arc is-mind"
            cx="100"
            cy="100"
            r={R_OUTER}
            stroke="url(#hud-grad-mind)"
            strokeWidth="7"
            strokeDasharray={C_OUTER}
            strokeDashoffset={dash(C_OUTER, m.mindPct)}
            transform="rotate(-90 100 100)"
          />

          <circle className="mono-hud-track" cx="100" cy="100" r={R_MID} strokeWidth="7" />
          <circle
            className="mono-hud-arc is-exec"
            cx="100"
            cy="100"
            r={R_MID}
            stroke="url(#hud-grad-exec)"
            strokeWidth="7"
            strokeDasharray={C_MID}
            strokeDashoffset={dash(C_MID, m.execPct)}
            transform="rotate(-90 100 100)"
          />

          <circle className="mono-hud-track" cx="100" cy="100" r={R_INNER} strokeWidth="7" />
          <circle
            className="mono-hud-arc is-body"
            cx="100"
            cy="100"
            r={R_INNER}
            stroke="url(#hud-grad-body)"
            strokeWidth="7"
            strokeDasharray={C_INNER}
            strokeDashoffset={dash(C_INNER, m.bodyPct)}
            transform="rotate(-90 100 100)"
          />
        </svg>

        <div className="mono-hud-center">
          <span className="mono-hud-score">{fmtNum(m.score)}</span>
          <span className="mono-hud-unit">OS</span>
        </div>
      </div>

      <div className="mono-hud-telemetry">
        <div className="mono-hud-channels">
          {channels.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className={`mono-hud-ch is-${ch.id}`}
              onClick={() => onGo?.(ch.tab)}
            >
              <span className="mono-hud-ch-top">
                <span className="mono-hud-ch-dot" aria-hidden="true" />
                <span className="mono-hud-ch-name">{ch.label}</span>
                <span className="mono-hud-ch-meta">{ch.meta}</span>
              </span>
              <span className="mono-hud-ch-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(4, ch.pct)}%` }} />
              </span>
            </button>
          ))}
        </div>

        <div className="mono-hud-spark">
          <div className="mono-hud-spark-head">
            <span className="mono-eyebrow">14D</span>
            <span className="mono-hud-spark-total">{fmtDur(m.thisWeekMin)}</span>
            {m.deltaPct !== null && (
              <span
                className={`mono-hud-delta${m.deltaPct >= 0 ? ' is-up' : ' is-down'}`}
                data-testid="hud-delta"
              >
                {m.deltaPct >= 0 ? `+${fmtNum(m.deltaPct)}%` : `${fmtNum(m.deltaPct)}%`}
              </span>
            )}
          </div>
          <svg className="mono-hud-svg" viewBox="0 0 280 68" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="hud-spark-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--mono-tint)" stopOpacity="0.34" />
                <stop offset="100%" stopColor="var(--mono-tint)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="hud-bar-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.22" />
              </linearGradient>
            </defs>
            {/* Concept 2 & 4: 14-day vertical volume telemetry bars behind the velocity curve */}
            {m.daily14.map((val, idx) => {
              const max = Math.max(25, ...m.daily14);
              const bh = Math.max(4, Math.round((val / max) * 52));
              const bx = idx * (268 / 13) + 2;
              return (
                <rect
                  key={idx}
                  x={bx.toFixed(1)}
                  y={66 - bh}
                  width="8"
                  height={bh}
                  rx="2.5"
                  fill="url(#hud-bar-grad)"
                  opacity={idx >= 7 ? 0.85 : 0.38}
                />
              );
            })}
            <path d={spark.area} fill="url(#hud-spark-fill)" />
            <path d={spark.line} className="mono-hud-spark-line" />
          </svg>
        </div>
      </div>
    </section>
  );
}
