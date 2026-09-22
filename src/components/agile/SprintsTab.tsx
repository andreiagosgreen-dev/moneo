import { useMemo, useState } from 'react';
import type { Task } from '../../lib/tasks';
import { updateTaskStatus, completeTask, taskPoints } from '../../lib/tasks';
import type { Sprint } from '../../lib/sprints';
import {
  createSprintObject,
  updateSprint,
  deleteSprint,
  addTasksToSprint,
  removeTaskFromSprint,
  sprintPoints,
  burndown,
  velocity,
  standup,
  formatStandup,
  sprintsForProject,
} from '../../lib/sprints';
import type { SprintsProps } from './types';
import { useI18n } from '../../lib/i18n/LocaleContext';
export default function SprintsTab({
  projectId,
  tasks,
  onTasksChange,
  sprints,
  sprintsChange,
  isPro,
}: SprintsProps) {
  const [name, setName] = useState('');
  const [length, setLength] = useState(14);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const i18n = useI18n();
  const { t, fmtNum } = i18n;

  const scoped = useMemo(
    () => (projectId ? sprintsForProject(sprints, projectId) : []),
    [sprints, projectId],
  );
  const projectTasks = useMemo(
    () => (projectId ? tasks.filter((t) => t.projectId === projectId) : []),
    [tasks, projectId],
  );
  const vel = useMemo(
    () => (isPro && projectId ? velocity(sprints, tasks, projectId) : null),
    [sprints, tasks, projectId, isPro],
  );

  if (!projectId) {
    return (
      <div className="empty-panel">
        <p className="text-[13px] text-sage">{t('agile.sp.none')}</p>
      </div>
    );
  }

  const create = () => {
    const sprint = createSprintObject(
      projectId,
      name || t('agile.sp.autoName', { n: scoped.length + 1 }),
      Date.now(),
      length,
    );
    if (!sprint) return;
    sprintsChange([...sprints, sprint]);
    setName('');
  };

  return (
    <div>
      {vel !== null && (
        <p className="font-mono text-[11px] text-faint" title={t('agile.sp.velTitle')}>
          {t('agile.sp.velocity', { n: fmtNum(vel) })}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder={t('agile.sp.ph')}
          className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
        />
        <select
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
            className="h-9 shrink-0 rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
            aria-label={t('agile.sp.length')}
          >
            <option value={7}>{t('agile.sp.w1')}</option>
            <option value={14}>{t('agile.sp.w2')}</option>
            <option value={28}>{t('agile.sp.w4')}</option>
          </select>
          <button
            onClick={create}
            className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
            aria-label={t('agile.sp.create')}
          >
            +
          </button>
      </div>

      {scoped.length === 0 ? (
        <div className="empty-panel mt-3">
          <p className="text-[13px] text-sage">{t('agile.sp.empty')}</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {scoped.slice(0, 5).map((s) => (
            <SprintRow
              key={s.id}
              sprint={s}
              tasks={tasks}
              projectTasks={projectTasks}
              onTasksChange={onTasksChange}
              sprints={sprints}
              sprintsChange={sprintsChange}
              addingTo={addingTo}
              setAddingTo={setAddingTo}
              isPro={isPro}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface SprintRowProps {
  sprint: Sprint;
  tasks: Task[];
  projectTasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  sprints: Sprint[];
  sprintsChange: (sprints: Sprint[]) => void;
  addingTo: string | null;
  setAddingTo: (id: string | null) => void;
  isPro: boolean;
}

function SprintRow({
  sprint,
  tasks,
  projectTasks,
  onTasksChange,
  sprints,
  sprintsChange,
  addingTo,
  setAddingTo,
  isPro,
}: SprintRowProps) {
  const [retro, setRetro] = useState(sprint.retro ?? '');
  const i18n = useI18n();
  const { t, fmtNum } = i18n;
  const pts = sprintPoints(sprint, tasks);
  const members = useMemo(() => {
    const index = new Map(tasks.map((t) => [t.id, t]));
    return sprint.taskIds
      .map((id) => index.get(id))
      .filter((t): t is Task => !!t && t.projectId === sprint.projectId);
  }, [sprint, tasks]);
  const series = useMemo(
    () => (isPro && sprint.status !== 'planned' ? burndown(sprint, tasks) : []),
    [sprint, tasks, isPro],
  );
  const standupText = useMemo(() => formatStandup(standup(sprint, tasks), i18n), [sprint, tasks, i18n]);
  const candidates = projectTasks.filter((t) => !sprint.taskIds.includes(t.id));

  const copyStandup = async () => {
    try {
      await navigator.clipboard.writeText(standupText);
    } catch {
      /* clipboard unavailable — text stays visible below */
    }
  };

  return (
    <li className="rounded-xl bg-ink/40 px-3.5 py-3 ring-1 ring-inset ring-line">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${sprint.status === 'active' ? 'bg-accent' : sprint.status === 'completed' ? 'bg-sage' : 'bg-line'}`}
          title={sprint.status}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-cream">
          {sprint.name}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-sage">
          {fmtNum(pts.done)}/{fmtNum(pts.total)}pt · {fmtNum(pts.pct)}%
        </span>
        {sprint.status === 'planned' && (
          <button
            onClick={() => sprintsChange(updateSprint(sprints, sprint.id, { status: 'active' }))}
            className="press shrink-0 rounded-md px-2 py-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
          >
            {t('agile.sp.start')}
          </button>
        )}
        {sprint.status === 'active' && (
          <button
            onClick={() => sprintsChange(updateSprint(sprints, sprint.id, { status: 'completed' }))}
            className="press shrink-0 rounded-md px-2 py-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
          >
            {t('agile.sp.close')}
          </button>
        )}
        <button
          onClick={() => {
            if (confirm(t('agile.sp.delConfirm', { name: sprint.name }))) {
              sprintsChange(deleteSprint(sprints, sprint.id));
            }
          }}
          className="press shrink-0 rounded p-1 text-faint hover:text-tomato"
          aria-label={t('agile.sp.del', { name: sprint.name })}
        >
          ✕
        </button>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pts.pct}%`,
            background: 'linear-gradient(90deg, var(--accent-deep), var(--accent))',
          }}
        />
      </div>

      {members.length > 0 && (
        <ul className="mt-2 space-y-1">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-lg bg-ink/50 px-2 py-1.5">
              <button
                onClick={() => {
                  const next =
                    m.status === 'completed'
                      ? updateTaskStatus(tasks, m.id, 'pending')
                      : completeTask(tasks, m.id).tasks;
                  onTasksChange(next);
                }}
                className={`press flex shrink-0 items-center justify-center rounded ring-1 ring-inset ${
                  m.status === 'completed'
                    ? 'bg-accent text-on-accent ring-accent'
                    : 'bg-ink/60 text-transparent ring-line'
                }`}
                style={{ width: 18, height: 18 }}
                aria-label={t('agile.sp.toggle', { title: m.title })}
              >
                <svg
                  width="10"
                  height="10"
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
              <span
                className={`min-w-0 flex-1 truncate text-[12px] text-cream/90 ${m.status === 'completed' ? 'line-through opacity-60' : ''}`}
              >
                {m.title}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-faint">
                {t('task.pts', { n: fmtNum(taskPoints(m)) })}
              </span>
              <button
                onClick={() => sprintsChange(removeTaskFromSprint(sprints, sprint.id, m.id))}
                className="press shrink-0 rounded px-1 font-mono text-[11px] text-faint hover:text-tomato"
                aria-label={t('agile.sp.pull', { title: m.title })}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {addingTo === sprint.id ? (
        <div className="mt-2 space-y-1">
          {candidates.length === 0 ? (
            <p className="font-mono text-[10px] text-faint">{t('agile.sp.allIn')}</p>
          ) : (
            candidates.slice(0, 8).map((t) => (
              <button
                key={t.id}
                onClick={() => sprintsChange(addTasksToSprint(sprints, tasks, sprint.id, [t.id]))}
                className="press block w-full truncate rounded-lg bg-ink/50 px-2.5 py-1.5 text-left text-[12px] text-sage ring-1 ring-inset ring-line hover:text-cream"
              >
                + {t.title}
              </button>
            ))
          )}
          <button
            onClick={() => setAddingTo(null)}
            className="press font-mono text-[10px] text-faint hover:text-cream"
          >
            {t('life.bal.done')}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingTo(sprint.id)}
          className="press mt-2 font-mono text-[11px] text-sage hover:text-cream"
        >
          {t('agile.sp.pullIn')}
        </button>
      )}

      {isPro && series.length > 1 && (
        <div className="mt-2.5 border-t border-line/60 pt-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
            {t('agile.sp.burndown')}
          </p>
          <div
            className="mt-1.5 flex h-12 items-end gap-[3px]"
            title={t('agile.sp.burnTitle')}
          >
            {series.slice(-21).map((d) => {
              const max = Math.max(1, ...series.map((x) => Math.max(x.actual, x.ideal)));
              return (
                <div
                  key={d.dayKey}
                  className="flex-1 rounded-t-sm bg-cream/25"
                  style={{ height: `${Math.max(4, (d.actual / max) * 100)}%` }}
                  title={t('agile.sp.barTitle', {
                    label: d.label,
                    actual: fmtNum(d.actual),
                    ideal: fmtNum(d.ideal),
                  })}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-2.5 border-t border-line/60 pt-2">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
            {t('agile.sp.standup')}
          </p>
          <button
            onClick={copyStandup}
            className="press font-mono text-[10px] text-sage hover:text-cream"
          >
            {t('okr.copy')}
          </button>
        </div>
        <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-sage">
          {standupText}
        </pre>
      </div>

      <textarea
        value={retro}
        rows={2}
        maxLength={2000}
        onChange={(e) => setRetro(e.target.value)}
        onBlur={() => {
          if ((retro.trim() || '') !== (sprint.retro ?? '')) {
            sprintsChange(updateSprint(sprints, sprint.id, { retro: retro.trim() || null }));
          }
        }}
        placeholder={t('agile.sp.retro')}
        className="mt-2 w-full resize-y rounded-lg bg-ink/50 px-2.5 py-2 text-[12px] leading-relaxed text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
      />
    </li>
  );
}
