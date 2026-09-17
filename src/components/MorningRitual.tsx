import { useState } from 'react';
import {
  addTaskToDay,
  renamePlanTask,
  setPlanEstimate,
  planForDay,
  IVY_MAX_TASKS,
  IVY_FREE_MAX_TASKS,
  type IvyPlan,
} from '../lib/ivyLee';
import {
  createBlock,
  weekdayOfKey,
  BLOCK_PALETTE,
  type TimeBlock,
  type Weekday,
} from '../lib/timeBlocks';
import { pickFrog } from '../lib/frog';
import { quadrantFocus } from '../lib/eisenhower';
import { goalProgress, rootGoals, type Goal } from '../lib/goals';
import type { Task } from '../lib/tasks';
import type { Project } from '../lib/projects';
import { dayCapacity, saveRitualDay } from '../lib/ritual';
import { dayKeyInTz } from '../lib/timezone';
import { OvercommitWarning } from './OvercommitWarning';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import { morningBrief } from '../lib/ai/coach';

const ESTIMATE_PRESETS = [15, 25, 50, 90];

interface RitualRow {
  id: string | null;
  text: string;
  estimate: number;
  at: string;
}

interface Props {
  plans: IvyPlan[];
  plansChange: (plans: IvyPlan[]) => void;
  tasks: Task[];
  projects: Project[];
  goals: Goal[];
  blocks: TimeBlock[];
  blocksChange: (blocks: TimeBlock[]) => void;
  timezone: string;
  isPro?: boolean;
  onDone: () => void;
}

function toMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

function toHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = ((min % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const STEP_TITLES: TKey[] = ['morning.step1', 'morning.step2', 'morning.step3'];
const STEP_HEADS: TKey[] = ['morning.h1', 'morning.h2', 'morning.h3'];

export default function MorningRitual({
  plans,
  plansChange,
  tasks,
  projects,
  goals,
  blocks,
  blocksChange,
  timezone,
  isPro = false,
  onDone,
}: Props) {
  const now = Date.now();
  const { t, fmtDur } = useI18n();
  const todayKey = dayKeyInTz(now, timezone);
  const maxTasks = isPro ? IVY_MAX_TASKS : IVY_FREE_MAX_TASKS;
  const [step, setStep] = useState(0);
  const [blocked, setBlocked] = useState(0);

  const [rows, setRows] = useState<RitualRow[]>(() => {
    const existing = planForDay(plans, todayKey)?.tasks ?? [];
    const out: RitualRow[] = existing.slice(0, maxTasks).map((t) => ({
      id: t.id,
      text: t.text,
      estimate: t.estimateMin ?? 25,
      at: '',
    }));
    if (out.length < 3) {
      const taken = new Set(out.map((r) => r.text));
      const candidates: string[] = [];
      const frog = pickFrog(tasks, projects, now);
      if (frog && !taken.has(frog.title)) candidates.push(frog.title);
      const focus = quadrantFocus(tasks, now);
      if (focus.task && !taken.has(focus.task.title) && !candidates.includes(focus.task.title)) {
        candidates.push(focus.task.title);
      }
      const goal = rootGoals(goals).find(
        (g) => !g.archived && goalProgress(goals, tasks, g.id) < 100,
      );
      if (goal) {
        const text = `🎯 ${goal.title}`;
        if (!taken.has(text) && !candidates.includes(text)) candidates.push(text);
      }
      for (const c of candidates) {
        if (out.length >= Math.min(3, maxTasks)) break;
        out.push({ id: null, text: c, estimate: 25, at: '' });
      }
    }
    let cursor = 9 * 60;
    for (const r of out) {
      r.at = toHHMM(cursor);
      cursor += r.estimate + 15;
    }
    return out;
  });

  const setRow = (i: number, patch: Partial<RitualRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const plannedMin = rows.filter((r) => r.text.trim()).reduce((s, r) => s + r.estimate, 0);
  const weekday = weekdayOfKey(todayKey) as Weekday;
  const availableMin = dayCapacity(blocks, weekday);

  const finish = () => {
    let acc = plans;
    for (const r of rows) {
      const text = r.text.trim();
      if (!text) continue;
      if (r.id) {
        acc = renamePlanTask(acc, todayKey, r.id, text);
        acc = setPlanEstimate(acc, todayKey, r.id, r.estimate);
      } else {
        const res = addTaskToDay(acc, todayKey, text, maxTasks, r.estimate);
        acc = res.plans;
      }
    }
    plansChange(acc);
    saveRitualDay(todayKey);
    onDone();
  };

  const skip = () => {
    saveRitualDay(todayKey);
    onDone();
  };

  const createBlocks = () => {
    const fresh: TimeBlock[] = [];
    rows.forEach((r, i) => {
      const text = r.text.trim();
      const start = toMin(r.at);
      if (!text || start === null) return;
      const b = createBlock({
        label: text,
        weekday,
        startMin: start,
        endMin: start + r.estimate,
        color: BLOCK_PALETTE[i % BLOCK_PALETTE.length],
      });
      if (b) fresh.push(b);
    });
    if (fresh.length > 0) {
      blocksChange([...blocks, ...fresh]);
      setBlocked((n) => n + fresh.length);
    }
  };

  const canNext = rows.some((r) => r.text.trim().length > 0);

  return (
    <div
      className="backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('morning.dialog')}
    >
      <div className="dialog-pop card max-h-[90vh] w-full max-w-md overflow-y-auto px-6 py-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          {t('morning.kicker', { step: t(STEP_TITLES[step]) })}
        </p>
        <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-cream">
          {t(STEP_HEADS[step])}
        </h2>
        {step === 0 &&
          (() => {
            const frog = pickFrog(tasks, projects, now);
            const line = morningBrief({
              freeMinutes: Math.max(0, availableMin - plannedMin),
              unblockTask: frog?.title ?? null,
            });
            return (
              <p className="mt-2 text-[12px] leading-relaxed text-sage">
                {t(line.key as TKey, line.vars)}
              </p>
            );
          })()}

        <div className="mt-3 flex items-center gap-1.5" aria-hidden>
          {STEP_TITLES.map((tk, i) => (
            <span
              key={tk}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 26 : 8,
                background: i <= step ? 'var(--accent)' : 'var(--color-line)',
              }}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="mt-4 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-center font-mono text-[11px] text-faint">
                  {i + 1}
                </span>
                <input
                  value={r.text}
                  maxLength={120}
                  onChange={(e) => setRow(i, { text: e.target.value })}
                  placeholder={i === 0 ? t('morning.ph1') : t('morning.ph2')}
                  aria-label={t('morning.taskAria', { n: i + 1 })}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-ink/60 px-3 text-sm text-cream transition-colors placeholder:text-faint focus:[border-color:var(--accent)] focus:outline-none"
                />
              </div>
            ))}
            <p className="text-[12px] text-faint">{t('morning.prefill')}</p>
          </div>
        )}

        {step === 1 && (
          <div className="mt-4 space-y-2">
            {rows.map((r, i) =>
              r.text.trim() ? (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl bg-ink/40 px-3 py-2 ring-1 ring-inset ring-line"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-cream/90">
                    {r.text.trim()}
                  </span>
                  <div
                    className="flex shrink-0 gap-1"
                    role="group"
                    aria-label={t('morning.estAria', { task: r.text.trim() })}
                  >
                    {ESTIMATE_PRESETS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setRow(i, { estimate: m })}
                        aria-pressed={r.estimate === m}
                        className={`press rounded-md px-2 py-1 font-mono text-[11px] ring-1 ring-inset ${
                          r.estimate === m
                            ? 'text-accent ring-accent/60'
                            : 'text-faint ring-line hover:text-cream'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
            <p className="font-mono text-[12px] text-sage">
              {t('morning.planned', { p: fmtDur(plannedMin), a: fmtDur(availableMin) })}
            </p>
            <OvercommitWarning plannedMin={plannedMin} availableMin={availableMin} />
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-2">
            {rows.map((r, i) =>
              r.text.trim() ? (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl bg-ink/40 px-3 py-2 ring-1 ring-inset ring-line"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-cream/90">
                    {r.text.trim()}
                  </span>
                  <input
                    type="time"
                    value={r.at}
                    onChange={(e) => setRow(i, { at: e.target.value })}
                    aria-label={`Start time for ${r.text.trim()}`}
                    className="h-8 w-[104px] shrink-0 rounded-lg bg-ink/60 px-2 font-mono text-[12px] text-cream ring-1 ring-inset ring-line focus:[border-color:var(--accent)] focus:outline-none"
                  />
                  <span className="shrink-0 font-mono text-[11px] text-faint">{r.estimate}m</span>
                </div>
              ) : null,
            )}
            {isPro ? (
              <button
                onClick={createBlocks}
                className="press btn-ghost w-full rounded-lg py-2 font-mono text-[12px] font-semibold"
              >
                {blocked > 0
                  ? t('morning.createBlocksAgain', { n: blocked })
                  : t('morning.createBlocks')}
              </button>
            ) : (
              <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-[12px] leading-relaxed text-cream">
                {t('morning.proNote')}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            onClick={skip}
            className="press rounded-lg px-3 py-2 font-mono text-[12px] text-faint hover:text-cream"
          >
            {t('morning.skip')}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="press btn-ghost rounded-lg px-4 py-2 font-mono text-[12px]"
              >
                {t('morning.back')}
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={() => canNext && setStep(step + 1)}
                disabled={!canNext}
                className="press btn-accent rounded-lg px-6 py-2 font-display text-[13px] font-bold disabled:opacity-40"
              >
                {t('morning.next')}
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={!canNext}
                className="press btn-accent rounded-lg px-6 py-2 font-display text-[13px] font-bold disabled:opacity-40"
              >
                {t('morning.finish')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
