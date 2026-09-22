import { useMemo, useState } from 'react';
import { type Session } from '../lib/store';
import type { Project } from '../lib/projects';
import {
  adherenceForDay,
  blocksForWeekday,
  conflictedBlockIds,
  createBlock,
  currentWeekKeys,
  deleteBlock,
  minuteOfDayInTz,
  weekdayOfKey,
  BLOCK_PALETTE,
  type TimeBlock,
  type Weekday,
} from '../lib/timeBlocks';
import { dayKeyInTz } from '../lib/timezone';
import { useI18n } from '../lib/i18n/LocaleContext';
import { conflictedBlockIdsFromEvents } from '../lib/calendarConflicts';
import type { ExternalCalendarEvent } from '../lib/googleCalendar';

interface Props {
  history: Session[];
  projects: Project[];
  timezone: string;
  isPro?: boolean;
  blocks: TimeBlock[];
  blocksChange: (blocks: TimeBlock[]) => void;
  /** Real Google Calendar events (Faza 10), read-only — never editable here. */
  externalEvents?: ExternalCalendarEvent[];
}

const SCALE_START = 6 * 60; // 06:00
const SCALE_END = 22 * 60; // 22:00
const SCALE_TOTAL = SCALE_END - SCALE_START;

const WEEKDAY_FALLBACK_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_FALLBACK_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

export default function CalendarCard({
  history,
  projects,
  timezone,
  isPro = false,
  blocks,
  blocksChange,
  externalEvents = [],
}: Props) {
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<'week' | 'list'>('week');
  const { t, tp, tag, fmtDur, fmtClock } = useI18n();

  /** Locale weekday names (Jan 4 2026 was a Sunday). */
  const weekdayName = (wd: number, style: 'short' | 'long'): string => {
    try {
      return new Intl.DateTimeFormat(tag, { weekday: style }).format(new Date(2026, 0, 4 + wd));
    } catch {
      return (style === 'short' ? WEEKDAY_FALLBACK_SHORT : WEEKDAY_FALLBACK_FULL)[wd] ?? '';
    }
  };
  const fmtDayNum = (key: string): string => {
    const [y, m, d] = key.split('-').map(Number);
    try {
      return new Date(y, m - 1, d).toLocaleDateString(tag, { day: 'numeric', month: 'numeric' });
    } catch {
      return key.split('-').slice(1).join('/');
    }
  };

  const [label, setLabel] = useState('');
  const [weekday, setWeekday] = useState<Weekday>(() =>
    weekdayOfKey(dayKeyInTz(Date.now(), timezone)),
  );
  const [startMin, setStartMin] = useState(9 * 60);
  const [endMin, setEndMin] = useState(10 * 60);
  const [color, setColor] = useState<string>(BLOCK_PALETTE[0]);
  const [projectId, setProjectId] = useState('');

  const weekKeys = useMemo(() => currentWeekKeys(timezone), [timezone]);
  const todayKey = dayKeyInTz(Date.now(), timezone);

  const commit = (next: TimeBlock[]) => {
    blocksChange(next);
  };

  const add = () => {
    const b = createBlock({
      label,
      weekday,
      startMin,
      endMin,
      color,
      projectId: projectId || undefined,
    });
    if (!b) return;
    commit([...blocks, b]);
    setLabel('');
    setAdding(false);
  };

  const adherenceMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof adherenceForDay>>();
    for (const key of weekKeys) {
      map.set(key, adherenceForDay(history, blocks, key, timezone));
    }
    return map;
  }, [history, blocks, weekKeys, timezone]);

  const anyBlocks = blocks.length > 0;
  const eventConflicts = useMemo(
    () => conflictedBlockIdsFromEvents(blocks, externalEvents, timezone),
    [blocks, externalEvents, timezone],
  );
  const conflicted = useMemo(() => {
    const ids = conflictedBlockIds(blocks);
    for (const id of eventConflicts) ids.add(id);
    return ids;
  }, [blocks, eventConflicts]);
  const draftOverlap = useMemo(
    () => blocksForWeekday(blocks, weekday).some((b) => startMin < b.endMin && endMin > b.startMin),
    [blocks, weekday, startMin, endMin],
  );

  return (
    <section className="card px-5 py-5 sm:px-6" aria-label={t('cal.aria')}>
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('cal.title')}
          </h2>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
            {t(isPro ? 'cal.subPro' : 'cal.subFree')}
          </p>
        </div>
        <span className="text-[11px] tabular-nums text-sage">{weekLabel(weekKeys, tag)}</span>
      </header>

      {/* view toggle + conflict banner */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex min-w-0 max-w-full flex-wrap gap-1 rounded-xl bg-ink/60 p-1 ring-1 ring-line">
          {(['week', 'list'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`press shrink-0 rounded-lg px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                view === v ? 'bg-cream/10 text-cream' : 'text-faint hover:text-sage'
              }`}
            >
              {t(v === 'week' ? 'cal.week' : 'cal.list')}
            </button>
          ))}
        </div>
        {conflicted.size > 0 && (
          <span className="text-[10px] font-bold text-tomato" title={t('cal.overlapTitle')}>
            ⚠ {tp('cal.overlaps', conflicted.size)}
          </span>
        )}
      </div>

      {view === 'week' ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-7">
          {weekKeys.map((key) => {
            const isToday = key === todayKey;
            const wd = weekdayOfKey(key);
            const ad = adherenceMap.get(key)!;
            const daySessions = history.filter((s) => dayKeyInTz(s.at, timezone) === key);
            return (
              <div key={key} className="flex flex-col">
                <div
                  className={`rounded-lg px-2 py-1.5 text-center ${
                    isToday ? 'bg-accent/15 ring-1 ring-accent/40' : 'bg-ink/40'
                  }`}
                >
                  <div
                    className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                      isToday ? 'text-accent' : 'text-cream/80'
                    }`}
                  >
                    {weekdayName(wd, 'short')}
                  </div>
                  <div className="font-mono text-[10px] text-faint">{fmtDayNum(key)}</div>
                  {ad.plannedMin > 0 && (
                    <div
                      className="mt-1 font-mono text-[11px] font-bold"
                      style={{
                        color:
                          ad.pct >= 80
                            ? 'var(--color-mint)'
                            : ad.pct >= 40
                              ? 'var(--color-sky)'
                              : 'var(--color-tomato)',
                      }}
                      title={t('cal.adherence', {
                        actual: fmtDur(ad.actualMin),
                        planned: fmtDur(ad.plannedMin),
                      })}
                    >
                      {ad.pct}%
                    </div>
                  )}
                </div>

                {/* timeline */}
                <div className="relative mt-1.5 h-64 rounded-lg bg-ink/30 ring-1 ring-inset ring-line/50">
                  {hourLines.map((min) => (
                    <div
                      key={min}
                      className="pointer-events-none absolute left-0 right-0 border-t border-line/30"
                      style={{ top: `${((min - SCALE_START) / SCALE_TOTAL) * 100}%` }}
                    />
                  ))}

                  {/* session pips */}
                  {daySessions.map((s) => {
                    const mod = minuteOfDayInTz(s.at, timezone);
                    if (mod < SCALE_START || mod > SCALE_END) return null;
                    const dur = Math.max(4, s.min);
                    return (
                      <div
                        key={s.id ?? `${s.at}-${s.min}`}
                        className="absolute left-1 right-1 rounded-sm"
                        style={{
                          top: `${((mod - SCALE_START) / SCALE_TOTAL) * 100}%`,
                          height: `${(Math.min(dur, 60) / SCALE_TOTAL) * 100}%`,
                          background: 'rgb(var(--accent-rgb) / 0.5)',
                        }}
                        title={t('cal.pip', { dur: fmtDur(s.min) })}
                      />
                    );
                  })}

                  {/* external calendar events (read-only, Faza 10) */}
                  {externalEvents
                    .filter((ev) => !ev.allDay && dayKeyInTz(ev.startsAt, timezone) === key)
                    .map((ev) => {
                      const mod = minuteOfDayInTz(ev.startsAt, timezone);
                      if (mod < SCALE_START || mod > SCALE_END) return null;
                      const durMin = Math.max(4, (ev.endsAt - ev.startsAt) / 60000);
                      return (
                        <div
                          key={ev.id}
                          className="pointer-events-none absolute left-1 right-1 overflow-hidden rounded-md border border-dashed border-faint/50 bg-ink/50 px-1.5 py-1"
                          style={{
                            top: `${((mod - SCALE_START) / SCALE_TOTAL) * 100}%`,
                            height: `${(Math.min(durMin, SCALE_TOTAL) / SCALE_TOTAL) * 100}%`,
                          }}
                          title={ev.title}
                        >
                          <div className="truncate text-[10px] font-medium leading-tight text-faint">
                            {ev.title || t('calendar.externalEventUntitled')}
                          </div>
                        </div>
                      );
                    })}

                  {/* blocks */}
                  {blocksForWeekday(blocks, wd as Weekday).map((b) => {
                    const span = b.endMin - b.startMin;
                    return (
                      <div
                        key={b.id}
                        className="absolute left-1 right-1 overflow-hidden rounded-md px-1.5 py-1"
                        style={{
                          top: `${((b.startMin - SCALE_START) / SCALE_TOTAL) * 100}%`,
                          height: `${(span / SCALE_TOTAL) * 100}%`,
                          background: `${b.color}2e`,
                          border: `1px solid ${b.color}99`,
                        }}
                        title={t('cal.blockTitle', {
                          label: b.label,
                          a: fmtClock(b.startMin),
                          b: fmtClock(b.endMin),
                          overlap: conflicted.has(b.id) ? t('cal.overlapSuffix') : '',
                        })}
                      >
                        <div
                          className="truncate text-[10px] font-semibold leading-tight"
                          style={{ color: b.color }}
                        >
                          {conflicted.has(b.id) && <span title={t('cal.overlapShort')}>⚠ </span>}
                          {b.label}
                        </div>
                        <div className="font-mono text-[8px] leading-tight opacity-70">
                          {fmtClock(b.startMin)}–{fmtClock(b.endMin)}
                        </div>
                        {isPro && (
                          <button
                            onClick={() => commit(deleteBlock(blocks, b.id))}
                            className="press absolute right-0.5 top-0.5 rounded p-0.5 text-[10px] text-cream/40 hover:text-tomato"
                            aria-label={t('cal.delBlock', { label: b.label })}
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {!anyBlocks && (
                    <p className="absolute inset-0 flex items-center justify-center px-2 text-center font-mono text-[10px] text-faint">
                      {t(isPro ? 'cal.emptyPro' : 'cal.emptyFree')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {weekKeys.map((key) => {
            const wd = weekdayOfKey(key);
            const ad = adherenceMap.get(key)!;
            const daySessions = history.filter((s) => dayKeyInTz(s.at, timezone) === key);
            const dayBlocks = blocksForWeekday(blocks, wd as Weekday);
            const [y, m, d] = key.split('-').map(Number);
            const label = (() => {
              try {
                return new Date(y, m - 1, d).toLocaleDateString(tag, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });
              } catch {
                return key;
              }
            })();
            return (
              <li key={key} className="rounded-xl bg-ink/40 px-3 py-2 ring-1 ring-inset ring-line">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold text-cream">
                    {label}
                    {key === todayKey && (
                      <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                        {t('cal.today')}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-sage">
                    {dayBlocks.length > 0 ? (
                      <>
                        {tp('cal.blocks', dayBlocks.length)}
                        {ad.plannedMin > 0 && (
                          <span className="ml-1.5 text-faint">
                            {t('cal.dayMeta', {
                              pct: ad.pct,
                              sessions: tp('cal.sessions', daySessions.length),
                            })}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </span>
                </div>
                {dayBlocks.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {dayBlocks.map((b) => (
                      <li key={b.id} className="flex items-center gap-2 text-[12px]">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="font-mono text-[11px] text-faint">
                          {fmtClock(b.startMin)}–{fmtClock(b.endMin)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-cream/90">
                          {conflicted.has(b.id) && <span title={t('cal.overlapShort')}>⚠ </span>}
                          {b.label}
                        </span>
                        {b.projectId && (
                          <span className="shrink-0 font-mono text-[10px] text-faint">
                            {projects.find((p) => p.id === b.projectId)?.name ?? t('cal.deleted')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* add / upsell */}
      {isPro ? (
        adding ? (
          <>
            {draftOverlap && (
              <p className="mt-3 rounded-lg bg-tomato/10 px-3 py-2 font-mono text-[11px] text-tomato ring-1 ring-inset ring-tomato/30">
                {t('cal.overlapWarn', { day: weekdayName(weekday, 'long') })}
              </p>
            )}
            <AddBlockForm
              label={label}
              setLabel={setLabel}
              weekday={weekday}
              setWeekday={setWeekday}
              startMin={startMin}
              setStartMin={setStartMin}
              endMin={endMin}
              setEndMin={setEndMin}
              color={color}
              setColor={setColor}
              projectId={projectId}
              setProjectId={setProjectId}
              projects={projects}
              dayNames={[0, 1, 2, 3, 4, 5, 6].map((wd) => weekdayName(wd, 'long'))}
              onCancel={() => setAdding(false)}
              onSave={add}
            />
          </>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="press btn-ghost mt-4 w-full rounded-lg py-2 font-mono text-[12px] font-semibold"
          >
            {t('cal.add')}
          </button>
        )
      ) : (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
          <div className="text-[13px] font-semibold text-cream">{t('cal.upTitle')}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-sage">{t('cal.upBody')}</p>
        </div>
      )}
    </section>
  );
}

const hourLines = Array.from({ length: SCALE_TOTAL / 60 + 1 }, (_, i) => SCALE_START + i * 60);

function weekLabel(keys: string[], tag: string): string {
  if (keys.length < 7) return '';
  const [y, m, d] = keys[0].split('-').map(Number);
  const [ey, em, ed] = keys[6].split('-').map(Number);
  const opts = { month: 'short', day: 'numeric' } as const;
  try {
    const a = new Date(y, m - 1, d).toLocaleDateString(tag, opts);
    const b = new Date(ey, em - 1, ed).toLocaleDateString(tag, opts);
    return `${a} – ${b}`;
  } catch {
    return `${m}/${d} – ${em}/${ed}`;
  }
}

function AddBlockForm({
  label,
  setLabel,
  weekday,
  setWeekday,
  startMin,
  setStartMin,
  endMin,
  setEndMin,
  color,
  setColor,
  projectId,
  setProjectId,
  projects,
  dayNames,
  onCancel,
  onSave,
}: {
  label: string;
  setLabel: (v: string) => void;
  weekday: Weekday;
  setWeekday: (v: Weekday) => void;
  startMin: number;
  setStartMin: (v: number) => void;
  endMin: number;
  setEndMin: (v: number) => void;
  color: string;
  setColor: (v: string) => void;
  projectId: string;
  setProjectId: (v: string) => void;
  projects: Project[];
  dayNames: string[];
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t, fmtClock } = useI18n();
  const minutes = () => {
    const out: number[] = [];
    for (let h = 5; h < 24; h++) {
      out.push(h * 60, h * 60 + 30);
    }
    return out;
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-line bg-ink/60 p-4">
      <input
        type="text"
        value={label}
        maxLength={40}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSave()}
        placeholder={t('cal.ph')}
        aria-label={t('cal.nameAria')}
        className="w-full rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            {t('cal.day')}
          </span>
          <select
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value) as Weekday)}
            className="rounded-lg bg-ink/40 px-2 py-1.5 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          >
            {dayNames.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            {t('cal.project')}
          </span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg bg-ink/40 px-2 py-1.5 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          >
            <option value="">{t('cal.none')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            {t('cal.start')}
          </span>
          <select
            value={startMin}
            onChange={(e) => setStartMin(Number(e.target.value))}
            className="rounded-lg bg-ink/40 px-2 py-1.5 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          >
            {minutes().map((m) => (
              <option key={m} value={m}>
                {fmtClock(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            {t('cal.end')}
          </span>
          <select
            value={Math.max(endMin, startMin + 30)}
            onChange={(e) => setEndMin(Number(e.target.value))}
            className="rounded-lg bg-ink/40 px-2 py-1.5 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          >
            {minutes()
              .filter((m) => m > startMin)
              .map((m) => (
                <option key={m} value={m}>
                  {fmtClock(m)}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        {BLOCK_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`press h-6 w-6 rounded-full ring-2 transition-all ${
              color === c ? 'ring-cream/70 scale-110' : 'ring-transparent'
            }`}
            style={{ background: c }}
            aria-label={t('cal.colorAria', { c })}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="press btn-ghost rounded-lg px-3 py-1.5 font-mono text-[12px]"
        >
          {t('cal.cancel')}
        </button>
        <button
          onClick={onSave}
          disabled={!label.trim()}
          className="press btn-accent rounded-lg px-4 py-1.5 font-display text-[13px] font-bold disabled:opacity-40"
        >
          {t('cal.save')}
        </button>
      </div>
    </div>
  );
}
