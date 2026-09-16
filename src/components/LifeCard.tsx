import { useMemo, useState } from 'react';
import type { Habit, HabitFrequency } from '../lib/habits';
import {
  FREE_HABITS_LIMIT,
  HABIT_TEMPLATES,
  activeHabits,
  createHabitObject,
  deleteHabit,
  habitStreak,
  habitSuccessRate,
  isHabitDue,
  toggleHabitDay,
  updateHabit,
  type HabitLog,
} from '../lib/habits';
import type { LifeArea } from '../lib/lifeAreas';
import { balanceReport, resetLifeAreas, updateLifeArea } from '../lib/lifeAreas';
import type { FocusArea } from '../lib/focusAreas';
import { activeAreas } from '../lib/focusAreas';
import type { Journal } from '../lib/journal';
import {
  MOOD_LABELS,
  WEEKLY_REFLECTION_PROMPTS,
  promptForDay,
  recentEntries,
  upsertEntry,
  weeklySummary,
  type Mood,
} from '../lib/journal';
import { energyAdvice, logEnergy, peakHours, formatHour, type EnergyEntry } from '../lib/energy';
import { localDayKey } from '../lib/projects';
import type { Session } from '../lib/store';

interface Props {
  habits: Habit[];
  habitsChange: (habits: Habit[]) => void;
  habitLog: HabitLog;
  habitLogChange: (log: HabitLog) => void;
  lifeAreas: LifeArea[];
  lifeAreasChange: (areas: LifeArea[]) => void;
  focusAreas: FocusArea[];
  journal: Journal;
  journalChange: (journal: Journal) => void;
  energyLog: EnergyEntry[];
  energyLogChange: (entries: EnergyEntry[]) => void;
  history: Session[];
  timezone: string;
  isPro?: boolean;
}

type LifeTab = 'habits' | 'balance' | 'journal' | 'energy';

const TABS: Array<{ id: LifeTab; label: string }> = [
  { id: 'habits', label: 'Habits' },
  { id: 'balance', label: 'Balance' },
  { id: 'journal', label: 'Journal' },
  { id: 'energy', label: 'Energy' },
];

export default function LifeCard(props: Props) {
  const [tab, setTab] = useState<LifeTab>('habits');

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="Life management">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">Life</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            Habits · balance · journal · energy
          </p>
        </div>
      </header>

      <div className="mt-4 flex gap-1 rounded-xl bg-ink/60 p-1 ring-1 ring-line w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`press rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              tab === t.id ? 'bg-cream/10 text-cream' : 'text-faint hover:text-sage'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'habits' && <HabitsTab {...props} />}
        {tab === 'balance' && <BalanceTab {...props} />}
        {tab === 'journal' && <JournalTab {...props} />}
        {tab === 'energy' && <EnergyTab {...props} />}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function HabitsTab({ habits, habitsChange, habitLog, habitLogChange, isPro = false }: Props) {
  const [draft, setDraft] = useState('');
  const [freq, setFreq] = useState<HabitFrequency>('daily');
  const [showTemplates, setShowTemplates] = useState(false);
  const now = Date.now();
  const todayKey = localDayKey(now);
  const active = useMemo(() => activeHabits(habits), [habits]);
  const atCapacity = !isPro && active.length >= FREE_HABITS_LIMIT;

  const commitLog = (log: HabitLog) => habitLogChange(log);

  const add = (name: string, frequency: HabitFrequency, target = 3) => {
    if (atCapacity) return;
    const habit = createHabitObject(name, frequency, target);
    if (!habit) return;
    habitsChange([...habits, habit]);
    setDraft('');
    setShowTemplates(false);
  };

  return (
    <div>
      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] leading-relaxed text-faint">
          Small daily wins compound.
          <br />
          Start from a template below.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {active.map((h) => {
            const doneSet = new Set(habitLog[h.id] ?? []);
            const doneToday = doneSet.has(todayKey);
            const streak = isPro ? habitStreak(h, habitLog, now) : 0;
            const due = isHabitDue(h, habitLog, now);
            const rate = isPro ? habitSuccessRate(habitLog, h.id, now, 30) : null;
            const stackName = h.stackAfter ? habits.find((x) => x.id === h.stackAfter)?.name : null;
            return (
              <li
                key={h.id}
                className={`rounded-xl bg-ink/40 px-3.5 py-2.5 ring-1 ring-inset ring-line ${doneToday ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => commitLog(toggleHabitDay(habitLog, h.id, todayKey))}
                    className={`press flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${
                      doneToday
                        ? 'bg-accent text-on-accent ring-accent'
                        : 'bg-ink/60 text-transparent ring-line hover:text-sage'
                    }`}
                    aria-label={doneToday ? `Unmark ${h.name}` : `Complete ${h.name} today`}
                    aria-pressed={doneToday}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 12.5l5 5L20 6.5" />
                    </svg>
                  </button>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`truncate text-[13px] font-medium text-cream/90 ${doneToday ? 'line-through' : ''}`}
                    >
                      {h.name}
                    </span>
                    <span className="ml-2 font-mono text-[10px] text-faint">
                      {h.frequency === 'weekly' ? `${h.targetPerWeek}x/week` : 'daily'}
                      {stackName ? ` · after ${stackName}` : ''}
                      {!due && !doneToday ? ' · done for now' : ''}
                    </span>
                  </div>
                  {h.frequency === 'weekly' && (
                    <select
                      value={h.targetPerWeek}
                      onChange={(e) =>
                        habitsChange(
                          updateHabit(habits, h.id, { targetPerWeek: Number(e.target.value) }),
                        )
                      }
                      className="h-6 shrink-0 rounded bg-ink/60 px-1 font-mono text-[10px] text-faint ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                      title="Weekly target"
                      aria-label={`Weekly target for ${h.name}`}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          {n}x
                        </option>
                      ))}
                    </select>
                  )}
                  {isPro && streak > 1 && (
                    <span className="shrink-0 font-mono text-[11px] text-sage" title="Streak">
                      🔥{streak}
                    </span>
                  )}
                  {isPro && rate !== null && (
                    <span
                      className="shrink-0 font-mono text-[10px] text-faint"
                      title="30-day success rate"
                    >
                      {Math.round(rate * 100)}%
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Delete habit “${h.name}”? Its log goes too.`)) {
                        const { habits: nextH, log: nextL } = deleteHabit(habits, habitLog, h.id);
                        habitsChange(nextH);
                        commitLog(nextL);
                      }
                    }}
                    className="press shrink-0 rounded p-1 text-faint hover:text-tomato"
                    aria-label={`Delete ${h.name}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!atCapacity ? (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              maxLength={80}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && draft.trim() && add(draft, freq)}
              placeholder="e.g. Read 10 pages…"
              className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
            <select
              value={freq}
              onChange={(e) => setFreq(e.target.value as HabitFrequency)}
              className="h-9 shrink-0 rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              aria-label="Frequency"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <button
              onClick={() => draft.trim() && add(draft, freq)}
              disabled={!draft.trim()}
              className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
              aria-label="Add habit"
            >
              +
            </button>
          </div>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="press mt-2 font-mono text-[11px] text-sage hover:text-cream"
          >
            {showTemplates ? '▴ Hide templates' : '▾ Start from a template'}
          </button>
          {showTemplates && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {HABIT_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => add(t.name, t.frequency, t.targetPerWeek)}
                  className="press rounded-full px-3 py-1.5 font-mono text-[11px] text-sage ring-1 ring-inset ring-line hover:text-cream hover:ring-accent/50"
                >
                  + {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        !isPro && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
            <p className="text-[12px] leading-relaxed text-cream">
              Free plan tracks up to {FREE_HABITS_LIMIT} habits.
            </p>
            <p className="mt-1 font-mono text-[11px] text-faint">
              Upgrade to Pro for unlimited habits, streaks and success analytics.
            </p>
          </div>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BalanceTab({ lifeAreas, lifeAreasChange, focusAreas, history, isPro = false }: Props) {
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const live = useMemo(() => activeAreas(focusAreas), [focusAreas]);
  const report = useMemo(
    () => balanceReport(lifeAreas, history, Date.now(), 7),
    [lifeAreas, history],
  );

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-4xl font-extrabold" style={{ color: 'var(--accent)' }}>
          {report.score}
        </span>
        <span className="text-[12px] text-sage">balance score · trailing 7 days</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-cream/90">{report.advice}</p>

      <ul className="mt-3 space-y-2">
        {report.areas.map((a) => {
          const linkedIds = lifeAreas.find((x) => x.id === a.id)?.linkedAreaIds ?? [];
          return (
          <li key={a.id} className="rounded-xl bg-ink/40 px-3.5 py-2.5 ring-1 ring-inset ring-line">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-cream/90">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color }}
                />
                <span className="truncate">{a.label}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-sage">
                {Math.round(a.actualPct)}% <span className="text-faint">/ {a.targetPct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, a.targetPct > 0 ? (a.actualPct / a.targetPct) * 100 : 0)}%`,
                  background: a.color,
                }}
              />
            </div>
            {(linkingId === a.id || linkedIds.length > 0) && (
              <div className="mt-2 border-t border-line/60 pt-2">
                {linkedIds.length > 0 && (
                  <p className="font-mono text-[10px] text-faint">
                    Linked:{' '}
                    {linkedIds
                      .map((id: string) => live.find((f) => f.id === id)?.name ?? 'Deleted')
                      .join(', ')}
                  </p>
                )}
                {linkingId === a.id ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {live.map((f) => {
                      const on = linkedIds.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            const next = on
                              ? linkedIds.filter((id: string) => id !== f.id)
                              : [...linkedIds, f.id];
                            lifeAreasChange(
                              updateLifeArea(lifeAreas, a.id, { linkedAreaIds: next }),
                            );
                          }}
                          className={`press rounded-full px-2.5 py-1 font-mono text-[10px] ring-1 ring-inset ${
                            on
                              ? 'text-accent ring-accent/50'
                              : 'text-faint ring-line hover:text-cream'
                          }`}
                          aria-pressed={on}
                        >
                          {f.name}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setLinkingId(null)}
                      className="press font-mono text-[10px] text-faint hover:text-cream"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setLinkingId(a.id)}
                    className="press mt-1 font-mono text-[10px] text-sage hover:text-cream"
                  >
                    Link focus areas…
                  </button>
                )}
                {isPro && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-[10px] text-faint">Target</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={a.targetPct}
                      onChange={(e) =>
                        lifeAreasChange(
                          updateLifeArea(lifeAreas, a.id, { targetPct: Number(e.target.value) }),
                        )
                      }
                      className="h-1.5 flex-1 accent-[var(--accent)]"
                      aria-label={`${a.label} target percent`}
                    />
                    <span className="font-mono text-[10px] text-sage">{a.targetPct}%</span>
                  </div>
                )}
              </div>
            )}
            {linkingId !== a.id && linkedIds.length === 0 && (
              <button
                onClick={() => setLinkingId(a.id)}
                className="press mt-1.5 font-mono text-[10px] text-sage hover:text-cream"
              >
                Link focus areas…
              </button>
            )}
          </li>
          );
        })}
      </ul>
      {report.unassignedMin > 0 && (
        <p className="mt-2 font-mono text-[11px] text-faint">
          {report.unassignedMin}m unassigned (sessions outside linked areas).
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        {!isPro && <p className="font-mono text-[11px] text-faint">Pro unlocks custom targets.</p>}
        <button
          onClick={() => {
            if (confirm('Reset life areas to defaults?')) lifeAreasChange(resetLifeAreas());
          }}
          className="press ml-auto font-mono text-[11px] text-faint hover:text-cream"
        >
          Reset defaults
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function JournalTab({ journal, journalChange, history, isPro = false }: Props) {
  const todayKey = localDayKey(Date.now());
  const entry = journal[todayKey];
  const [mood, setMood] = useState<Mood | null>(entry?.mood ?? null);
  const [gratitude, setGratitude] = useState<string[]>(entry?.gratitude ?? []);
  const [gratDraft, setGratDraft] = useState('');
  const [text, setText] = useState(entry?.text ?? '');
  const [savedTick, setSavedTick] = useState(0);

  const prompt = useMemo(() => promptForDay(Date.now()), []);
  const recent = useMemo(() => (isPro ? recentEntries(journal, 7) : []), [journal, isPro]);
  const summary = useMemo(
    () => (isPro ? weeklySummary(history, journal) : null),
    [history, journal, isPro],
  );

  const save = () => {
    journalChange(upsertEntry(journal, todayKey, { mood, gratitude, text }));
    setSavedTick((t) => t + 1);
  };

  return (
    <div>
      <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-[13px] font-medium leading-relaxed text-cream">
        {prompt}
      </p>

      <div className="mt-3 flex items-center gap-1.5" role="group" aria-label="Mood">
        {([1, 2, 3, 4, 5] as Mood[]).map((m) => (
          <button
            key={m}
            onClick={() => setMood(mood === m ? null : m)}
            className={`press h-9 flex-1 rounded-lg font-mono text-[12px] ring-1 ring-inset transition-colors ${
              mood === m
                ? 'bg-accent/20 text-cream ring-accent/60'
                : 'text-faint ring-line hover:text-cream'
            }`}
            title={MOOD_LABELS[m]}
            aria-pressed={mood === m}
          >
            {m}
          </button>
        ))}
        <span className="ml-1 w-14 shrink-0 font-mono text-[10px] text-faint">
          {mood ? MOOD_LABELS[mood] : '—'}
        </span>
      </div>

      <div className="mt-2.5">
        <div className="flex flex-wrap gap-1.5">
          {gratitude.map((g) => (
            <span
              key={g}
              className="flex items-center gap-1 rounded-full bg-ink/60 px-2.5 py-1 text-[12px] text-sage ring-1 ring-inset ring-line"
            >
              ♥ {g}
              <button
                onClick={() => setGratitude(gratitude.filter((x) => x !== g))}
                className="press text-faint hover:text-cream"
                aria-label={`Remove ${g}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        {gratitude.length < 3 && (
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="text"
              value={gratDraft}
              maxLength={120}
              onChange={(e) => setGratDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && gratDraft.trim()) {
                  setGratitude([...gratitude, gratDraft.trim()]);
                  setGratDraft('');
                }
              }}
              placeholder="Grateful for… (max 3)"
              className="h-8 min-w-0 flex-1 rounded-lg bg-ink/40 px-2.5 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
          </div>
        )}
      </div>

      <textarea
        value={text}
        maxLength={2000}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        placeholder="Free reflection…"
        className="mt-2.5 w-full resize-y rounded-lg bg-ink/40 px-3 py-2.5 text-[13px] leading-relaxed text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={save}
          className="press btn-accent rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Save entry
        </button>
        {savedTick > 0 && <span className="font-mono text-[11px] text-sage">Saved.</span>}
      </div>

      {isPro && (
        <div className="mt-4 border-t border-line/60 pt-3">
          {summary && (
            <p className="font-mono text-[11px] leading-relaxed text-faint">
              Week: {summary.minutes}m · {summary.sessions} sessions · {summary.daysActive}d active
              {summary.mood !== null && ` · mood ${summary.mood.toFixed(1)}`}
            </p>
          )}
          <ul className="mt-2 space-y-1">
            {WEEKLY_REFLECTION_PROMPTS.map((q) => (
              <li key={q} className="text-[12px] text-sage">
                → {q}
              </li>
            ))}
          </ul>
          {recent.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {recent.map((e) => (
                <li
                  key={e.dayKey}
                  className="rounded-lg bg-ink/40 px-3 py-2 ring-1 ring-inset ring-line"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10px] text-faint">{e.dayKey}</span>
                    {e.mood !== undefined && (
                      <span className="font-mono text-[10px] text-sage">
                        {e.mood}/5 · {MOOD_LABELS[e.mood]}
                      </span>
                    )}
                  </div>
                  {e.text && <p className="mt-0.5 truncate text-[12px] text-cream/80">{e.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!isPro && (
        <p className="mt-3 font-mono text-[11px] text-faint">
          Pro unlocks entry history and the weekly reflection.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EnergyTab({ energyLog, energyLogChange, isPro = false }: Props) {
  const [level, setLevel] = useState(7);
  const now = useMemo(() => Date.now(), []);
  const peaks = useMemo(() => (isPro ? peakHours(energyLog, now, 3) : []), [energyLog, isPro, now]);
  const advice = useMemo(() => (isPro ? energyAdvice(energyLog, now) : null), [energyLog, isPro, now]);
  const todayCount = energyLog.filter((e) => localDayKey(e.at) === localDayKey(now)).length;

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={1}
          max={10}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="h-1.5 flex-1 accent-[var(--accent)]"
          aria-label="Energy level 1-10"
        />
        <span className="w-8 shrink-0 text-center font-display text-xl font-bold text-cream">
          {level}
        </span>
        <button
          onClick={() => energyLogChange(logEnergy(energyLog, level))}
          className="press btn-accent shrink-0 rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Log
        </button>
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-faint">
        {todayCount} check-in{todayCount === 1 ? '' : 's'} today · 1 drained → 10 wired
      </p>

      {isPro ? (
        <div className="mt-3">
          {advice && <p className="text-[13px] leading-relaxed text-cream/90">{advice}</p>}
          {peaks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {peaks.map((p) => (
                <span
                  key={p.hour}
                  className="rounded-full bg-ink/60 px-2.5 py-1 font-mono text-[11px] text-sage ring-1 ring-inset ring-line"
                  title={`${p.samples} samples, avg ${p.avg.toFixed(1)}`}
                >
                  ⚡ {formatHour(p.hour)} · {p.avg.toFixed(1)}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 font-mono text-[11px] text-faint">
          Pro reveals your peak hours and scheduling advice.
        </p>
      )}
    </div>
  );
}
