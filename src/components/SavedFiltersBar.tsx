import { useMemo, useState } from 'react';
import type { Project } from '../lib/projects';
import type { Task, TaskPriority, TaskStatus } from '../lib/tasks';
import { TASK_PRIORITIES } from '../lib/tasks';
import type { FilterCriteria, SavedFilter } from '../lib/savedFilters';
import {
  MAX_SAVED_FILTERS,
  applyFilter,
  createSavedFilter,
  removeSavedFilter,
} from '../lib/savedFilters';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  filters: SavedFilter[];
  filtersChange: (filters: SavedFilter[]) => void;
  tasks: Task[];
  projects: Project[];
  onSelectProject: (id: string) => void;
}

const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed'];

export default function SavedFiltersBar({
  filters,
  filtersChange,
  tasks,
  projects,
  onSelectProject,
}: Props) {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [projectId, setProjectId] = useState('');
  const [dueWithinDays, setDueWithinDays] = useState('');

  const active = filters.find((f) => f.id === activeId) ?? null;
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '';

  const matches = useMemo(() => {
    if (!active) return [];
    return applyFilter(tasks, active).filter((t) => t.status !== 'completed');
  }, [active, tasks]);

  const save = () => {
    const criteria: FilterCriteria = {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(projectId ? { projectId } : {}),
      ...(dueWithinDays.trim() ? { dueWithinDays: Number(dueWithinDays) } : {}),
    };
    filtersChange(createSavedFilter(filters, name, criteria));
    setName('');
    setStatus('');
    setPriority('');
    setProjectId('');
    setDueWithinDays('');
    setShowCreate(false);
  };

  if (filters.length === 0 && !showCreate) {
    return (
      <button
        onClick={() => setShowCreate(true)}
        className="press mt-2 font-mono text-[11px] text-faint hover:text-cream"
      >
        {t('filters.newView')}
      </button>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((f) => (
          <div key={f.id} className="flex items-center">
            <button
              onClick={() => setActiveId(activeId === f.id ? null : f.id)}
              className={`press rounded-full px-3 py-1 font-mono text-[11px] ring-1 ring-inset transition-colors ${
                activeId === f.id
                  ? 'bg-accent/15 text-accent ring-accent/40'
                  : 'bg-ink/40 text-sage ring-line hover:text-cream'
              }`}
            >
              {f.name}
            </button>
            {activeId === f.id && (
              <button
                onClick={() => {
                  filtersChange(removeSavedFilter(filters, f.id));
                  setActiveId(null);
                }}
                aria-label={t('filters.remove')}
                className="press ml-0.5 px-1 text-[12px] text-faint hover:text-cream"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {filters.length < MAX_SAVED_FILTERS && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="press rounded-full px-3 py-1 font-mono text-[11px] text-faint ring-1 ring-inset ring-line hover:text-cream"
          >
            {showCreate ? t('filters.cancel') : t('filters.newView')}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-ink/40 p-2 ring-1 ring-inset ring-line">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('filters.namePlaceholder')}
            className="h-8 min-w-0 flex-1 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus | '')}
            className="h-8 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          >
            <option value="">{t('filters.anyStatus')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`filters.status.${s}` as const)}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority | '')}
            className="h-8 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          >
            <option value="">{t('filters.anyPriority')}</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-8 min-w-0 max-w-[140px] rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          >
            <option value="">{t('filters.anyProject')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={dueWithinDays}
            onChange={(e) => setDueWithinDays(e.target.value)}
            placeholder={t('filters.dueWithinDays')}
            className="h-8 w-20 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
          />
          <button
            onClick={save}
            disabled={!name.trim()}
            className="press btn-accent rounded-lg px-3 py-1.5 font-display text-[12px] font-bold disabled:opacity-40"
          >
            {t('filters.save')}
          </button>
        </div>
      )}

      {active && (
        <div className="mt-2 space-y-1.5">
          {matches.length === 0 ? (
            <p className="text-[12px] text-faint">{t('filters.empty')}</p>
          ) : (
            matches.map((task) => (
              <button
                key={task.id}
                onClick={() => onSelectProject(task.projectId)}
                className="press flex w-full items-center justify-between gap-2 rounded-lg bg-ink/40 px-3 py-2 text-left ring-1 ring-inset ring-line hover:ring-accent/40"
              >
                <span className="min-w-0 flex-1 truncate text-[12px] text-cream">{task.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-faint">
                  {projectName(task.projectId)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
