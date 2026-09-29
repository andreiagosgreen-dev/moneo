import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import MonoCard from './MonoCard';
import MonoProgress from './MonoProgress';
import MonoRing from './MonoRing';
import { toggleHabitDay, type Habit, type HabitLog } from '../lib/habits';
import {
  buildHabitMonth,
  shiftMonth,
  weekIndexInMonth,
  type HabitMonthWeek,
} from '../lib/habitMonth';
import { mondayOf, parseDayKey } from '../lib/dayKeys';
import { localDayKey } from '../lib/projects';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  habits: Habit[];
  habitLog: HabitLog;
  onHabitLogChange: (log: HabitLog) => void;
  now?: number;
}

/** How far back the month switcher goes. */
const HISTORY_MONTHS = 12;

interface Pos {
  row: number;
  col: number;
}

/** Month grid of habit check-ins with week and month summaries. */
export default function MonoHabitMonth({
  habits,
  habitLog,
  onHabitLogChange,
  now = Date.now(),
}: Props) {
  const { t, tag, fmtNum, fmtDayKey } = useI18n();
  const todayKey = localDayKey(now);
  const today = parseDayKey(todayKey)!;

  const [view, setView] = useState({ year: today.y, month: today.m });
  const offset = (view.year - today.y) * 12 + (view.month - today.m);
  const isCurrent = offset === 0;

  const data = useMemo(
    () => buildHabitMonth(habits, habitLog, view.year, view.month, todayKey),
    [habits, habitLog, view.year, view.month, todayKey],
  );
  const lastOpenCol = isCurrent ? today.d - 1 : data.keys.length - 1;

  const [focus, setFocus] = useState<Pos>({ row: 0, col: today.d - 1 });
  const active: Pos = {
    row: Math.min(focus.row, Math.max(0, data.rows.length - 1)),
    col: Math.min(focus.col, lastOpenCol),
  };

  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const headRefs = useRef<Array<HTMLTableCellElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cornerRef = useRef<HTMLTableCellElement>(null);
  const pendingFocus = useRef(false);

  const fmt = useMemo(
    () => ({
      title: new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      weekday: new Intl.DateTimeFormat(tag, { weekday: 'narrow', timeZone: 'UTC' }),
    }),
    [tag],
  );
  const title = fmt.title.format(Date.UTC(view.year, view.month - 1, 1));

  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    cellRefs.current.get(`${active.row}:${active.col}`)?.focus();
  });

  // The current week is the first thing visible on a phone.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    if (!isCurrent) {
      scroller.scrollLeft = 0;
      return;
    }
    const monday = parseDayKey(mondayOf(todayKey));
    const col = monday && monday.m === today.m ? monday.d - 1 : 0;
    const head = headRefs.current[col];
    const sticky = cornerRef.current?.offsetWidth ?? 0;
    if (head) scroller.scrollLeft = Math.max(0, head.offsetLeft - sticky);
  }, [isCurrent, todayKey, today.m, view.year, view.month]);

  const goMonth = (delta: number) => {
    const next = shiftMonth(view.year, view.month, delta);
    const nextIsCurrent = next.year === today.y && next.month === today.m;
    setView(next);
    setFocus({ row: active.row, col: nextIsCurrent ? today.d - 1 : 0 });
  };

  const moveTo = (pos: Pos) => {
    pendingFocus.current = true;
    setFocus(pos);
  };

  const onGridKey = (e: KeyboardEvent<HTMLTableElement>) => {
    const { row, col } = active;
    const lastRow = data.rows.length - 1;
    let next: Pos | null = null;
    if (e.key === 'ArrowRight') next = { row, col: Math.min(lastOpenCol, col + 1) };
    else if (e.key === 'ArrowLeft') next = { row, col: Math.max(0, col - 1) };
    else if (e.key === 'ArrowDown') next = { row: Math.min(lastRow, row + 1), col };
    else if (e.key === 'ArrowUp') next = { row: Math.max(0, row - 1), col };
    else if (e.key === 'Home') next = { row, col: 0 };
    else if (e.key === 'End') next = { row, col: lastOpenCol };
    if (!next) return;
    e.preventDefault();
    moveTo(next);
  };

  const weekLabel = (w: HabitMonthWeek, i: number) =>
    `${t('mono.habits.weekShort', { n: fmtNum(i + 1) })} ${fmtNum(w.pct)}%`;

  return (
    <MonoCard style={{ padding: '14px 12px' }}>
      <div className="mono-hgrid-head">
        <button
          type="button"
          className="mono-hgrid-nav"
          aria-label={t('mono.habits.prevMonth')}
          disabled={offset <= -HISTORY_MONTHS}
          onClick={() => goMonth(-1)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
        </button>
        <h3 className="mono-h3 mono-hgrid-title" aria-live="polite">
          {title}
        </h3>
        <button
          type="button"
          className="mono-hgrid-nav"
          aria-label={t('mono.habits.nextMonth')}
          disabled={isCurrent}
          onClick={() => goMonth(1)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7.5 4.5 13 10l-5.5 5.5" />
          </svg>
        </button>
      </div>

      <div className="mono-hgrid-scroll" ref={scrollRef}>
        <table
          className="mono-hgrid"
          role="grid"
          aria-label={t('mono.habits.gridAria', { month: title })}
          onKeyDown={onGridKey}
        >
          <thead>
            <tr>
              <td className="mono-hgrid-corner" ref={cornerRef} />
              {data.keys.map((key, c) => {
                const d = c + 1;
                const tint = weekIndexInMonth(key, view.year, view.month) % 2 === 1;
                const isToday = key === todayKey;
                return (
                  <th
                    key={key}
                    scope="col"
                    ref={(el) => {
                      headRefs.current[c] = el;
                    }}
                    className={`mono-hgrid-day${tint ? ' is-tint' : ''}${isToday ? ' is-today' : ''}`}
                  >
                    <span aria-hidden="true">
                      {fmt.weekday.format(Date.UTC(view.year, view.month - 1, d))}
                    </span>
                    <span>{fmtNum(d)}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, r) => (
              <tr key={row.habitId}>
                <th scope="row" className="mono-hgrid-name">
                  <div className="mono-hgrid-namebox">
                    <span className="mono-hgrid-label" title={row.name}>
                      {row.name}
                    </span>
                    <span className="mono-hgrid-meter">
                      <MonoProgress
                        value={row.pct}
                        size="sm"
                        tone="accent"
                        label={t('mono.habits.rowPct', { pct: fmtNum(row.pct) })}
                      />
                      <span className="mono-hgrid-pct" aria-hidden="true">
                        {fmtNum(row.pct)}%
                      </span>
                    </span>
                  </div>
                </th>
                {row.cells.map((cell, c) => {
                  const tint = weekIndexInMonth(cell.key, view.year, view.month) % 2 === 1;
                  const vars = { name: row.name, date: fmtDayKey(cell.key) };
                  const label = cell.future
                    ? t('mono.habits.cellFuture', vars)
                    : t(cell.done ? 'mono.habits.cellDone' : 'mono.habits.cellOpen', vars);
                  const cls = [
                    'mono-hcell',
                    cell.key === todayKey ? 'is-today' : '',
                    cell.beforeStart && !cell.done ? 'is-before' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <td key={cell.key} className={tint ? 'is-tint' : undefined}>
                      <button
                        type="button"
                        ref={(el) => {
                          const k = `${r}:${c}`;
                          if (el) cellRefs.current.set(k, el);
                          else cellRefs.current.delete(k);
                        }}
                        className={cls}
                        aria-pressed={cell.done}
                        aria-label={label}
                        disabled={cell.future}
                        tabIndex={r === active.row && c === active.col ? 0 : -1}
                        onFocus={() => {
                          if (r !== focus.row || c !== focus.col) setFocus({ row: r, col: c });
                        }}
                        onClick={() =>
                          onHabitLogChange(toggleHabitDay(habitLog, row.habitId, cell.key))
                        }
                      >
                        {cell.done ? (
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M5 10.5l3.2 3.2L15 7" />
                          </svg>
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mono-hgrid-summary">
        <div className="mono-hgrid-total">
          <MonoRing
            value={data.total.pct}
            size={72}
            label={t('mono.habits.monthRingAria', { pct: fmtNum(data.total.pct) })}
          >
            {fmtNum(data.total.pct)}%
          </MonoRing>
          <p className="mono-meta">
            {t('mono.habits.monthTotal', {
              done: fmtNum(data.total.done),
              expected: fmtNum(data.total.expected),
            })}
          </p>
        </div>
        <div>
          <p className="mono-eyebrow">{t('mono.habits.weeks')}</p>
          <WeekBars
            weeks={data.weeks}
            label={t('mono.habits.weeksAria', { list: data.weeks.map(weekLabel).join(', ') })}
            short={(i) => t('mono.habits.weekShort', { n: fmtNum(i + 1) })}
          />
        </div>
        {data.top.length > 0 ? (
          <div>
            <p className="mono-eyebrow">{t('mono.habits.top')}</p>
            <ol className="mono-hgrid-top">
              {data.top.map((h) => (
                <li key={h.habitId}>
                  <span>{h.name}</span>
                  <span className="mono-hgrid-pct">{fmtNum(h.pct)}%</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </MonoCard>
  );
}

const BAR_W = 16;
const BAR_GAP = 14;
const BAR_H = 56;
const LABEL_H = 16;

function WeekBars({
  weeks,
  label,
  short,
}: {
  weeks: HabitMonthWeek[];
  label: string;
  short: (i: number) => string;
}) {
  const width = weeks.length * (BAR_W + BAR_GAP) - BAR_GAP;
  return (
    <svg
      className="mono-wbars"
      role="img"
      aria-label={label}
      width={width}
      height={BAR_H + LABEL_H}
      viewBox={`0 0 ${width} ${BAR_H + LABEL_H}`}
    >
      {weeks.map((w, i) => {
        const x = i * (BAR_W + BAR_GAP);
        const h = Math.round((BAR_H * w.pct) / 100);
        return (
          <g key={w.mondayKey}>
            <rect className="mono-wbars-track" x={x} y={0} width={BAR_W} height={BAR_H} rx={4} />
            {h > 0 ? (
              <rect
                className="mono-wbars-bar"
                x={x}
                y={BAR_H - h}
                width={BAR_W}
                height={h}
                rx={4}
              />
            ) : null}
            <text className="mono-wbars-label" x={x + BAR_W / 2} y={BAR_H + 12} textAnchor="middle">
              {short(i)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
