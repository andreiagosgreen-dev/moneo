import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addTaskToDay,
  getIvyAnalytics,
  planDoneCount,
  planForDay,
  movePlanTask,
  setPlanEstimate,
  removePlanTask,
  renamePlanTask,
  togglePlanTask,
  IVY_FREE_MAX_TASKS,
  IVY_MAX_TASKS,
  type IvyPlan,
  type IvyTask,
} from '../lib/ivyLee';
import { dayKeyInTz } from '../lib/timezone';
import { completeTask, updateTaskStatus, type Task } from '../lib/tasks';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  plans: IvyPlan[];
  plansChange: (plans: IvyPlan[]) => void;
  timezone: string;
  isPro?: boolean;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
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

export default function IvyLeeCard({
  plans,
  plansChange,
  timezone,
  isPro = false,
  tasks,
  onTasksChange,
}: Props) {
  const { t } = useI18n();
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

  /** Ticking an Ivy entry linked to a real Task also completes/reopens
   *  that task, so project/goal progress rollups pick it up. An entry
   *  whose linked task was deleted elsewhere just toggles locally. */
  const toggle = (task: IvyTask) => {
    plansChange(togglePlanTask(plans, todayKey, task.id));
    if (task.taskId && tasks.some((t) => t.id === task.taskId)) {
      onTasksChange(
        !task.done
          ? completeTask(tasks, task.taskId).tasks
          : updateTaskStatus(tasks, task.taskId, 'pending'),
      );
    }
  };

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('ivy.ariaLabel')}>
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('ivy.title')}
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {isPro ? t('ivy.subtitlePro') : t('ivy.subtitleFree')}
          </p>
        </div>
        <span className="font-mono text-[11px] text-sage">{dateLabel}</span>
      </header>

      {/* progress */}
      {total > 0 && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[12px] text-cream">
              {t('ivy.doneCount', { done: String(done), total: String(total) })}
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
            onToggle={() => toggle(task)}
            onRename={(text) => plansChange(renamePlanTask(plans, todayKey, task.id, text))}
            onRemove={() => plansChange(removePlanTask(plans, todayKey, task.id))}
            onEstimate={(min) => plansChange(setPlanEstimate(plans, todayKey, task.id, min))}
            onMove={(dir) => plansChange(movePlanTask(plans, todayKey, task.id, dir))}
            disableUp={i === 0}
            disableDown={i === total - 1}
          />
        ))}
      </ol>

      {total === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] leading-relaxed text-faint">
          {t('ivy.emptyLine1', { n: String(maxTasks) })}
          <br />
          {t('ivy.emptyLine2')}
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
            placeholder={total === 0 ? t('ivy.placeholderFirst') : t('ivy.placeholderNext')}
            className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
          />
          <button
            onClick={add}
            disabled={!draft.trim()}
            className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
            aria-label={t('ivy.addAria')}
          >
            +
          </button>
        </div>
      ) : (
        !isPro && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
            <div className="text-[13px] font-semibold text-cream">
              {t('ivy.capacityLine', { n: String(IVY_FREE_MAX_TASKS) })}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-sage">{t('ivy.capacityUpgrade')}</p>
          </div>
        )
      )}

      {/* analytics — Pro only */}
      {isPro
        ? analytics.activeDays > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line/60 pt-4">
              <Stat
                label={t('ivy.stat.rate')}
                value={`${Math.round(analytics.average * 100)}%`}
                accent
              />
              <Stat label={t('ivy.stat.perfectDays')} value={String(analytics.perfectDays)} />
              <Stat label={t('ivy.stat.activeDays')} value={String(analytics.activeDays)} />
            </div>
          )
        : analytics.activeDays > 0 && (
            <div className="mt-4 border-t border-line/60 pt-3">
              <p className="text-[11px] text-faint">
                <span className="font-semibold text-sage">
                  {Math.round(analytics.average * 100)}%
                </span>{' '}
                {t('ivy.freeAnalytics.prefix')} <span className="text-accent">Pro</span>{' '}
                {t('ivy.freeAnalytics.suffix')}
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
  onEstimate,
  onMove,
  disableUp,
  disableDown,
}: {
  task: IvyTask;
  index: number;
  onToggle: () => void;
  onRename: (text: string) => void;
  onRemove: () => void;
  onEstimate: (min: number | null) => void;
  onMove: (dir: -1 | 1) => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  const { t } = useI18n();
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
        aria-label={task.done ? t('ivy.row.markIncomplete') : t('ivy.row.markComplete')}
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
      <select
        value={typeof task.estimateMin === 'number' ? task.estimateMin : ''}
        onChange={(e) => onEstimate(e.target.value === '' ? null : Number(e.target.value))}
        className="h-7 shrink-0 rounded-md bg-ink/60 px-1 font-mono text-[10px] text-faint ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
        title={t('ivy.row.estimateTitle')}
        aria-label={t('ivy.row.estimateAria', { text: task.text })}
      >
        <option value="">—</option>
        {[15, 25, 50, 90].map((m) => (
          <option key={m} value={m}>
            {m}m
          </option>
        ))}
      </select>
      <button
        onClick={onRemove}
        className="press shrink-0 rounded p-1 text-faint opacity-0 transition-opacity hover:text-tomato focus:opacity-100 group-hover:opacity-100"
        aria-label={t('ivy.row.deleteAria', { text: task.text })}
      >
        <TrashIcon />
      </button>
      <span className="flex shrink-0 flex-col opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          onClick={() => onMove(-1)}
          disabled={disableUp}
          className="press rounded px-1 font-mono text-[10px] leading-none text-faint hover:text-cream disabled:opacity-30"
          aria-label={t('ivy.row.moveUpAria', { text: task.text })}
        >
          ▲
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={disableDown}
          className="press rounded px-1 font-mono text-[10px] leading-none text-faint hover:text-cream disabled:opacity-30"
          aria-label={t('ivy.row.moveDownAria', { text: task.text })}
        >
          ▼
        </button>
      </span>
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
