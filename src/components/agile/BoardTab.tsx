import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '../../lib/tasks';
import {
  TASK_STATUSES,
  STATUS_KEYS,
  tasksForProject,
  updateTaskStatus,
  completeTask,
  criticalChain,
} from '../../lib/tasks';
import type { BoardProps } from './types';
import { useI18n } from '../../lib/i18n/LocaleContext';
import type { TKey } from '../../lib/i18n/types';
const STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed'];

export default function BoardTab({
  projectId,
  tasks,
  onTasksChange,
  board,
  commitBoard,
  isPro,
}: BoardProps) {
  const scoped = useMemo(
    () => (projectId ? tasksForProject(tasks, projectId) : []),
    [tasks, projectId],
  );
  const critical = useMemo(
    () =>
      isPro && projectId
        ? new Set(criticalChain(tasks, projectId).map((t) => t.id))
        : new Set<string>(),
    [tasks, projectId, isPro],
  );
  const flow = useMemo(() => {
    if (!isPro) return null;
    const done = scoped.filter(
      (t) => t.status === 'completed' && typeof t.completedAt === 'number',
    );
    const week = done.filter((t) => (t.completedAt as number) > Date.now() - 7 * 24 * 3600_000);
    const cycles = done
      .map((t) => ((t.completedAt as number) - t.createdAt) / (24 * 3600_000))
      .filter((d) => d >= 0);
    const avgCycle = cycles.length > 0 ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null;
    return { throughput: week.length, avgCycle };
  }, [scoped, isPro]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [lanes, setLanes] = useState<'off' | 'priority'>('off');
  const { t, fmtNum } = useI18n();

  if (!projectId) {
    return (
      <div className="empty-panel">
        <p className="text-[13px] text-sage">{t('agile.board.none')}</p>
      </div>
    );
  }

  const move = (task: Task, dir: -1 | 1) => {
    const idx = STATUS_ORDER.indexOf(task.status);
    const next = STATUS_ORDER[Math.min(3, Math.max(0, idx + dir))];
    if (next === task.status) return;
    moveTo(task, next);
  };

  const moveTo = (task: Task, status: TaskStatus) => {
    if (status === task.status) return;
    if (status === 'completed') {
      onTasksChange(completeTask(tasks, task.id).tasks);
    } else {
      onTasksChange(updateTaskStatus(tasks, task.id, status));
    }
  };

  const dropOnto = (status: TaskStatus) => {
    const task = tasks.find((t) => t.id === dragId);
    setDragId(null);
    setDragOver(null);
    if (!task || task.projectId !== projectId) return;
    moveTo(task, status);
  };

  const laneGroups = (col: Task[]): Array<{ label: string | null; items: Task[] }> => {
    if (lanes === 'off') return [{ label: null, items: col.slice(0, 6) }];
    const order: Task['priority'][] = ['p0', 'p1', 'p2', 'p3'];
    return order
      .map((p) => ({
        label: p.toUpperCase(),
        items: col.filter((t) => t.priority === p).slice(0, 4),
      }))
      .filter((g) => g.items.length > 0);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        {isPro && flow ? (
          <p className="font-mono text-[11px] text-faint">
            {t('agile.flow', {
              n: fmtNum(flow.throughput),
              avg:
                flow.avgCycle !== null
                  ? t('agile.flowAvg', {
                      avg:
                        flow.avgCycle < 1
                          ? t('agile.ltDay')
                          : t('agile.days', { n: flow.avgCycle.toFixed(1) }),
                    })
                  : '',
            })}
          </p>
        ) : (
          <span />
        )}
        <button
          onClick={() => setLanes(lanes === 'off' ? 'priority' : 'off')}
          className={`press shrink-0 rounded-md px-2 py-1 font-mono text-[10px] ring-1 ring-inset ${
            lanes === 'priority'
              ? 'text-accent ring-accent/50'
              : 'text-faint ring-line hover:text-cream'
          }`}
          aria-pressed={lanes === 'priority'}
          title={t('agile.lanesTitle')}
        >
          {t('agile.lanes', { mode: lanes === 'off' ? t('agile.lanesOff') : 'P0–P3' })}
        </button>
      </div>
      {isPro && (
        <details className="mt-2">
          <summary className="cursor-pointer font-mono text-[10px] text-faint hover:text-cream">
            {t('agile.boardSettings')}
          </summary>
          <div className="mt-1.5 space-y-1">
            {TASK_STATUSES.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <input
                  type="text"
                  value={board.columnLabels[s] ?? ''}
                  maxLength={24}
                  onChange={(e) => {
                    const columnLabels = { ...board.columnLabels };
                    if (e.target.value.trim()) columnLabels[s] = e.target.value.trim();
                    else delete columnLabels[s];
                    commitBoard({ ...board, columnLabels });
                  }}
                  placeholder={t(STATUS_KEYS[s] as TKey)}
                  className="h-7 min-w-0 flex-1 rounded-lg bg-ink/50 px-2 font-mono text-[11px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                  aria-label={t('agile.colLabel', { name: t(STATUS_KEYS[s] as TKey) })}
                />
                <button
                  onClick={() => {
                    const hidden = board.hidden.includes(s)
                      ? board.hidden.filter((x) => x !== s)
                      : [...board.hidden, s];
                    commitBoard({ ...board, hidden });
                  }}
                  className={`press shrink-0 rounded-md px-2 py-1 font-mono text-[10px] ring-1 ring-inset ${
                    board.hidden.includes(s)
                      ? 'text-tomato ring-tomato/40'
                      : 'text-faint ring-line hover:text-cream'
                  }`}
                  aria-pressed={board.hidden.includes(s)}
                  title={t(board.hidden.includes(s) ? 'agile.colShow' : 'agile.colHide')}
                >
                  {t(board.hidden.includes(s) ? 'agile.hidden' : 'agile.hide')}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TASK_STATUSES.filter((s) => !board.hidden.includes(s)).map((status) => {
          const col = scoped.filter((t) => t.status === status);
          const limit = board.wipLimits[status];
          const over = isPro && limit !== undefined && col.length > limit;
          const hot = dragOver === status;
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver((cur) => (cur === status ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                dropOnto(status);
              }}
              className={`rounded-xl bg-ink/40 px-3 py-2.5 ring-1 ring-inset transition-colors ${
                hot ? 'ring-accent' : 'ring-line'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-bold text-cream">
                  {board.columnLabels[status] ?? t(STATUS_KEYS[status] as TKey)}{' '}
                  <span
                    className={`font-mono text-[11px] ${over ? 'font-bold text-tomato' : 'text-faint'}`}
                  >
                    {col.length}
                    {isPro && limit !== undefined && `/${limit}`}
                  </span>
                </span>
                {isPro && (
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={limit ?? ''}
                    onChange={(e) => {
                      const v =
                        e.target.value === ''
                          ? undefined
                          : Math.max(1, Math.floor(Number(e.target.value) || 0));
                      const wipLimits = { ...board.wipLimits };
                      if (v === undefined) delete wipLimits[status];
                      else wipLimits[status] = v;
                      commitBoard({ ...board, wipLimits });
                    }}
                    placeholder="WIP"
                    className="h-6 w-14 rounded bg-ink/60 px-1.5 font-mono text-[10px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                    title={t('agile.wipTitle')}
                  />
                )}
              </div>
              {over && (
                <p className="mt-1 font-mono text-[10px] font-bold text-tomato">
                  {t('agile.wipOver')}
                </p>
              )}
              <ul className="mt-1.5 space-y-1">
                {laneGroups(col).map((group) => (
                  <li key={group.label ?? 'all'}>
                    {group.label && (
                      <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-faint">
                        {group.label}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {group.items.map((card) => (
                        <li
                          key={card.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', card.id);
                            setDragId(card.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragOver(null);
                          }}
                          className={`flex cursor-grab items-center gap-1.5 rounded-lg bg-ink/50 px-2 py-1.5 active:cursor-grabbing ${
                            dragId === card.id ? 'opacity-50' : ''
                          }`}
                        >
                          <button
                            onClick={() => move(card, -1)}
                            disabled={card.status === 'pending'}
                            className="press shrink-0 rounded px-1 font-mono text-[12px] text-faint hover:text-cream disabled:opacity-30"
                            aria-label={t('agile.back')}
                          >
                            ‹
                          </button>
                          <span
                            className="min-w-0 flex-1 truncate text-[12px] text-cream/90"
                            title={t('agile.dragHint', { title: card.title })}
                          >
                            {isPro && critical.has(card.id) && (
                              <span title={t('agile.critical')}>⛓ </span>
                            )}
                            {card.title}
                          </span>
                          {typeof card.points === 'number' && (
                            <span className="shrink-0 font-mono text-[10px] text-faint">
                              {t('task.pts', { n: fmtNum(card.points) })}
                            </span>
                          )}
                          <button
                            onClick={() => move(card, 1)}
                            disabled={card.status === 'completed'}
                            className="press shrink-0 rounded px-1 font-mono text-[12px] text-faint hover:text-cream disabled:opacity-30"
                            aria-label={t('agile.fwd')}
                          >
                            ›
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
                {lanes === 'off' && col.length > 6 && (
                  <li className="font-mono text-[10px] text-faint">
                    {t('agile.more', { n: fmtNum(col.length - 6) })}
                  </li>
                )}
                {col.length === 0 && (
                  <li className="font-mono text-[10px] text-faint">{t('agile.emptyCol')}</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
      {!isPro && (
        <p className="mt-3 font-mono text-[11px] text-faint">{t('agile.proBox')}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
