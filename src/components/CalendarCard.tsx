import { useMemo, useState } from 'react';
import { type Session } from '../lib/store';
import type { Project } from '../lib/projects';
import {
  adherenceForDay,
  blocksForWeekday,
  createBlock,
  currentWeekKeys,
  deleteBlock,
  loadBlocks,
  minuteOfDayInTz,
  weekdayOfKey,
  BLOCK_PALETTE,
  type TimeBlock,
  type Weekday,
} from '../lib/timeBlocks';
import { dayKeyInTz } from '../lib/timezone';
import { fmtMinutes } from '../lib/store';

interface Props {
  history: Session[];
  projects: Project[];
  timezone: string;
  isPro?: boolean;
  blocksChange: (blocks: TimeBlock[]) => void;
}

const SCALE_START = 6 * 60; // 06:00
const SCALE_END = 22 * 60; // 22:00
const SCALE_TOTAL = SCALE_END - SCALE_START;

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtHM(min: number): string {
  return `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(
    2,
    '0',
  )}`;
}

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
  blocksChange,
}: Props) {
  const [blocks, setBlocks] = useState<TimeBlock[]>(loadBlocks);
  const [adding, setAdding] = useState(false);

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
    setBlocks(next);
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

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="Time blocking calendar">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">This week</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {isPro ? 'time blocks' : 'time blocks · read-only'}
          </p>
        </div>
        <span className="font-mono text-[11px] text-sage">{weekLabel(weekKeys)}</span>
      </header>

      {/* calendar */}
      <div className="mt-5 grid gap-2 sm:grid-cols-7">
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
                  {WEEKDAY_SHORT[wd]}
                </div>
                <div className="font-mono text-[10px] text-faint">
                  {key.split('-').slice(1).join('/')}
                </div>
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
                    title={`${fmtMinutes(ad.actualMin)} of ${fmtMinutes(ad.plannedMin)} planned focused`}
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
                      title={`${fmtMinutes(s.min)} focused`}
                    />
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
                      title={`${b.label} · ${fmtHM(b.startMin)}–${fmtHM(b.endMin)}`}
                    >
                      <div
                        className="truncate text-[10px] font-semibold leading-tight"
                        style={{ color: b.color }}
                      >
                        {b.label}
                      </div>
                      <div className="font-mono text-[8px] leading-tight opacity-70">
                        {fmtHM(b.startMin)}–{fmtHM(b.endMin)}
                      </div>
                      {isPro && (
                        <button
                          onClick={() => commit(deleteBlock(blocks, b.id))}
                          className="press absolute right-0.5 top-0.5 rounded p-0.5 text-[10px] text-cream/40 hover:text-tomato"
                          aria-label={`Delete block ${b.label}`}
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  );
                })}

                {!anyBlocks && (
                  <p className="absolute inset-0 flex items-center justify-center px-2 text-center font-mono text-[10px] text-faint">
                    {isPro ? 'Add a block to plan focus' : 'No blocks yet'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* add / upsell */}
      {isPro ? (
        adding ? (
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
            onCancel={() => setAdding(false)}
            onSave={add}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="press btn-ghost mt-4 w-full rounded-lg py-2 font-mono text-[12px] font-semibold"
          >
            + Add time block
          </button>
        )
      ) : (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
          <div className="text-[13px] font-semibold text-cream">
            Plan your week with time blocks
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-sage">
            Recurring focus windows, adherence scores, and project-linked schedules are part of
            Moneo Pro.
          </p>
        </div>
      )}
    </section>
  );
}

const hourLines = Array.from({ length: SCALE_TOTAL / 60 + 1 }, (_, i) => SCALE_START + i * 60);

function weekLabel(keys: string[]): string {
  if (keys.length < 7) return '';
  const [y, m, d] = keys[0].split('-').map(Number);
  const [ey, em, ed] = keys[6].split('-').map(Number);
  const a = new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const b = new Date(ey, em - 1, ed).toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${a} – ${b}`;
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
  onCancel: () => void;
  onSave: () => void;
}) {
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
        placeholder="e.g. Deep work, Client calls…"
        className="w-full rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Day</span>
          <select
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value) as Weekday)}
            className="rounded-lg bg-ink/40 px-2 py-1.5 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          >
            {WEEKDAY_FULL.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Project</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg bg-ink/40 px-2 py-1.5 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          >
            <option value="">None</option>
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
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Start</span>
          <select
            value={startMin}
            onChange={(e) => setStartMin(Number(e.target.value))}
            className="rounded-lg bg-ink/40 px-2 py-1.5 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          >
            {minutes().map((m) => (
              <option key={m} value={m}>
                {fmtHM(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">End</span>
          <select
            value={Math.max(endMin, startMin + 30)}
            onChange={(e) => setEndMin(Number(e.target.value))}
            className="rounded-lg bg-ink/40 px-2 py-1.5 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          >
            {minutes()
              .filter((m) => m > startMin)
              .map((m) => (
                <option key={m} value={m}>
                  {fmtHM(m)}
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
            aria-label={`Color ${c}`}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="press btn-ghost rounded-lg px-3 py-1.5 font-mono text-[12px]"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!label.trim()}
          className="press btn-accent rounded-lg px-4 py-1.5 font-display text-[13px] font-bold disabled:opacity-40"
        >
          Save block
        </button>
      </div>
    </div>
  );
}
