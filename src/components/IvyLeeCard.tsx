import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addTaskToDay,
  getIvyAnalytics,
  planDoneCount,
  planForDay,
  removePlanTask,
  renamePlanTask,
  togglePlanTask,
  IVY_FREE_MAX_TASKS,
  IVY_MAX_TASKS,
  type IvyPlan,
  type IvyTask,
} from '../lib/ivyLee';
import { dayKeyInTz } from '../lib/timezone';

interface Props {
  plans: IvyPlan[];
  plansChange: (plans: IvyPlan[]) => void;
  timezone: string;
  isPro?: boolean;
}

function CheckIcon() {
  return (
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
  );
}

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
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

export default function IvyLeeCard({ plans, plansChange, timezone, isPro = false }: Props) {
  const [draft, setDraft] = useState('');
  const todayKey = dayKeyInTz(Date.now(), timezone);
  const maxTasks = isPro ? IVY_MAX_TASKS : IVY_FREE_MAX_TASKS;

  const plan = useMemo(() => planForDay(plans, todayKey), [plans, todayKey]);
  const done = planDoneCount(plan);
  const total = plan?.tasks.length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const analytics = useMemo(() => getIvyAnalytics(plans), [plans]);

  const add = () => {
    const { plans: next, added } = addTaskToDay(plans, todayKey, draft, maxTasks);
    if (added) {
      plansChange(next);
      setDraft('');
    }
  };

  const dateLabel = useMemo(() => {
    const [y, m, d] = todayKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, [todayKey]);

  const atCapacity = total >= maxTasks;

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="Ivy Lee daily plan">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">Today's plan</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            Ivy Lee · {isPro ? '6 tasks' : '3 tasks'}
          </p>
        </div>
        <span className="font-mono text-[11px] text-sage">{dateLabel}</span>
      </header>

      {/* progress */}
      {total > 0 && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[12px] text-cream">
              {done}/{total} done
            </span>
            <span className="font-mono text-[11px] text-faint">{pct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, var(--accent-deep), var(--accent))',
                boxShadow: '0 0 10px rgb(var(--accent-rgb) / 0.5)',
              }}
            />
          </div>
        </div>
      )}

      {/* task list */}
      <ol className="mt-4 space-y-1.5">
        {plan?.tasks.map((task, i) => (
          <IvyRow
            key={task.id}
            task={task}
            index={i}
            onToggle={() => plansChange(togglePlanTask(plans, todayKey, task.id))}
            onRename={(text) => plansChange(renamePlanTask(plans, todayKey, task.id, text))}
            onRemove={() => plansChange(removePlanTask(plans, todayKey, task.id))}
          />
        ))}
      </ol>

      {total === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] leading-relaxed text-faint">
          Pick the {maxTasks} most important things for today, in order.
          <br />
          Work the list top to bottom.
        </p>
      )}

      {/* add */}
      {!atCapacity ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={draft}
            maxLength={120}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={total === 0 ? 'Most important task…' : 'Add next task…'}
            className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
          />
          <button
            onClick={add}
            disabled={!draft.trim()}
            className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
            aria-label="Add task"
          >
            +
          </button>
        </div>
      ) : (
        !isPro && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
            <div className="text-[13px] font-semibold text-cream">
              Free plan limits the list to {IVY_FREE_MAX_TASKS} tasks
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-sage">
              Upgrade to Moneo Pro for all 6 Ivy Lee slots and weekly success analytics.
            </p>
          </div>
        )
      )}

      {/* analytics — Pro only */}
      {isPro
        ? analytics.activeDays > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line/60 pt-4">
              <Stat label="7-day rate" value={`${Math.round(analytics.average * 100)}%`} accent />
              <Stat label="Perfect days" value={String(analytics.perfectDays)} />
              <Stat label="Active days" value={String(analytics.activeDays)} />
            </div>
          )
        : analytics.activeDays > 0 && (
            <div className="mt-4 border-t border-line/60 pt-3">
              <p className="text-[11px] text-faint">
                <span className="font-semibold text-sage">
                  {Math.round(analytics.average * 100)}%
                </span>{' '}
                completion across recent days · <span className="text-accent">Pro</span> unlocks
                weekly analytics
              </p>
            </div>
          )}
    </section>
  );
}

function IvyRow({
  task,
  index,
  onToggle,
  onRename,
  onRemove,
}: {
  task: IvyTask;
  index: number;
  onToggle: () => void;
  onRename: (text: string) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(task.text);
  const committed = useRef(task.text);

  useEffect(() => {
    setText(task.text);
    committed.current = task.text;
  }, [task.text]);

  const commit = () => {
    const clean = text.trim();
    if (!clean) {
      setText(task.text);
      return;
    }
    if (clean !== committed.current) {
      onRename(clean);
      committed.current = clean;
    }
  };

  return (
    <li
      className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-ink/40 ${
        task.done ? 'opacity-60' : ''
      }`}
    >
      <span className="w-4 shrink-0 text-center font-mono text-[11px] text-faint">{index + 1}</span>
      <button
        onClick={onToggle}
        className={`press flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${
          task.done
            ? 'bg-accent text-on-accent ring-accent'
            : 'bg-ink/60 text-transparent ring-line hover:text-sage'
        }`}
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
      >
        <CheckIcon />
      </button>
      <input
        type="text"
        value={text}
        maxLength={120}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={`min-w-0 flex-1 bg-transparent text-[13px] text-cream/90 outline-none ${
          task.done ? 'line-through' : ''
        }`}
      />
      <button
        onClick={onRemove}
        className="press shrink-0 rounded p-1 text-faint opacity-0 transition-opacity hover:text-tomato focus:opacity-100 group-hover:opacity-100"
        aria-label={`Delete task ${task.text}`}
      >
        <TrashIcon />
      </button>
    </li>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-ink/40 px-2.5 py-2 text-center">
      <div
        className="font-display text-[17px] font-bold leading-none"
        style={accent ? { color: 'var(--accent)' } : undefined}
      >
        {value}
      </div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
        {label}
      </div>
    </div>
  );
}
