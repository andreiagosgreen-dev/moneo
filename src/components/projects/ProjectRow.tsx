import { useState } from 'react';
import type { ProjectCategory, ProjectStats } from '../../lib/projects';
import {
  PROJECT_COLORS,
  PROJECT_CATEGORIES,
  CATEGORY_LABELS,
  updateProject,
  getMinutesForProject,
  formatProjectDuration,
  billableAmount,
  formatBillable,
  parseTags,
  getProjectStats,
} from '../../lib/projects';
import type { TaskPriority } from '../../lib/tasks';
import {
  createTaskObject,
  rootTasks,
  suggestDeadline,
  projectCompletion,
  PRIORITY_LABELS,
  TASK_TEMPLATES,
  bulkSetPriority,
  bulkSetDueAt,
  bulkMoveToProject,
} from '../../lib/tasks';
import type { Session } from '../../lib/store';
import { ChevronIcon, TrashIcon, CopyIcon, ArchiveIcon, PlusIcon } from './icons';
import type { ProjectRowProps } from './types';
import TaskRow from './TaskRow';
import { useI18n } from '../../lib/i18n/LocaleContext';
import LinkedItems from '../LinkedItems';

export default function ProjectRow({
  project,
  history,
  tasks,
  isSelected,
  isExpanded,
  onToggleExpand,
  onSelect,
  onDelete,
  onArchive,
  onClone,
  onProjectsChange,
  onTasksChange,
  links,
  onLinksChange,
  goals,
  allProjects,
  skills,
  objectives,
}: ProjectRowProps) {
  const { t } = useI18n();
  const minutes = getMinutesForProject(project.id, history);
  const timeFormatted = formatProjectDuration(minutes);
  const completion = projectCompletion(tasks, project.id);
  const projectTasks = rootTasks(tasks, project.id);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editCategory, setEditCategory] = useState<string>(project.category);
  const [editColor, setEditColor] = useState(project.color);
  const [editTags, setEditTags] = useState(project.tags.join(', '));
  const [editDeadline, setEditDeadline] = useState(
    project.deadline ? new Date(project.deadline).toISOString().slice(0, 10) : '',
  );
  const [editBillable, setEditBillable] = useState(project.billable === true);
  const [editRate, setEditRate] = useState(
    typeof project.hourlyRate === 'number' ? String(project.hourlyRate) : '',
  );

  const [docDraft, setDocDraft] = useState(project.doc ?? '');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('p2');

  const saveEdit = () => {
    if (!editName.trim()) {
      setEditing(false);
      setEditName(project.name);
      return;
    }
    const deadline = editDeadline ? new Date(editDeadline + 'T12:00:00').getTime() : null;
    const rate = editBillable && editRate.trim() ? Number(editRate) : null;
    onProjectsChange(
      updateProject([project], project.id, {
        name: editName,
        category: editCategory as ProjectCategory,
        color: editColor,
        tags: parseTags(editTags),
        deadline,
        billable: editBillable,
        hourlyRate: rate !== null && Number.isFinite(rate) && rate > 0 ? rate : null,
      }),
    );
    setEditing(false);
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    const task = createTaskObject(project.id, newTaskTitle, newTaskPriority);
    onTasksChange([...tasks, task]);
    setNewTaskTitle('');
  };

  const toggleSelectTask = (id: string) =>
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedIdsArr = Array.from(selectedTaskIds);
  const clearSelection = () => setSelectedTaskIds(new Set());
  const bulkApplyPriority = (priority: TaskPriority) => {
    onTasksChange(bulkSetPriority(tasks, selectedIdsArr, priority));
  };
  const bulkApplyDueAt = (dueAt: number | null) => {
    onTasksChange(bulkSetDueAt(tasks, selectedIdsArr, dueAt));
  };
  const bulkApplyMove = () => {
    if (!bulkMoveTarget) return;
    onTasksChange(bulkMoveToProject(tasks, selectedIdsArr, bulkMoveTarget));
    clearSelection();
    setBulkMoveTarget('');
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        isSelected
          ? 'border-accent/80 bg-accent/10 shadow-[0_0_15px_-3px_rgb(var(--accent-rgb)/0.15)]'
          : 'border-line/60 bg-ink/40'
      }`}
    >
      <div
        onClick={onSelect}
        className="group flex cursor-pointer items-center justify-between gap-3 px-3.5 py-3"
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm"
            style={{ backgroundColor: project.color }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-cream">{project.name}</span>
              {isSelected && (
                <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-accent">
                  {t('projectRow.active')}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-faint">
              <span className="capitalize">
                {t(CATEGORY_LABELS[project.category as ProjectCategory])}
              </span>
              <span>·</span>
              <span className="font-mono text-sage">{timeFormatted}</span>
              {completion.total > 0 && (
                <>
                  <span>·</span>
                  <span className="font-mono">
                    {t('projectRow.taskCount', { done: completion.done, total: completion.total })}
                  </span>
                </>
              )}
            </div>
            {project.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] text-faint"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(project.id);
            }}
            className="press flex h-7 w-7 items-center justify-center rounded-lg text-faint hover:text-cream"
            title={isExpanded ? t('projectRow.collapse') : t('projectRow.expand')}
            aria-label={
              isExpanded
                ? t('projectRow.collapseFor', { name: project.name })
                : t('projectRow.expandFor', { name: project.name })
            }
          >
            <ChevronIcon open={isExpanded} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-line/60 px-3.5 pb-4 pt-3">
          {/* stats mini-panel */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('projectRow.statTime')} value={timeFormatted} accent />
            <Stat
              label={t('projectRow.statSessions')}
              value={String(projectStats(history, project.id).sessions)}
            />
            <Stat
              label={t('projectRow.statTasksDone')}
              value={`${completion.done}/${completion.total || '—'}`}
            />
            {project.billable === true && (
              <Stat
                label={t('projectRow.statBillable')}
                value={formatBillable(billableAmount(project, minutes))}
                accent
              />
            )}
          </div>

          {/* edit controls */}
          <div className="mt-3">
            {editing ? (
              <div className="space-y-2.5 rounded-xl border border-line bg-ink/50 p-3">
                <input
                  type="text"
                  value={editName}
                  maxLength={50}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1.5">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      className={`h-5 w-5 rounded-full transition-transform ${
                        editColor === c ? 'scale-110 ring-2 ring-cream/70' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={t('projectRow.setColor', { color: c })}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                  >
                    {PROJECT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(CATEGORY_LABELS[c])}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                      className="h-[42px] min-w-0 flex-1 rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const eta = suggestDeadline(tasks, project.id);
                        if (eta) setEditDeadline(new Date(eta).toISOString().slice(0, 10));
                      }}
                      className="press h-[42px] shrink-0 rounded-lg px-2.5 text-[11px] font-semibold text-sage ring-1 ring-inset ring-line hover:text-cream"
                      title={t('projectRow.autoDeadlineTitle')}
                    >
                      {t('projectRow.auto')}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder={t('projectRow.tagsPlaceholder')}
                  className="w-full rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditBillable(!editBillable)}
                    className={`press flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                      editBillable ? 'bg-accent' : 'bg-line/50'
                    }`}
                    aria-pressed={editBillable}
                    title={t('projectRow.billableTitle')}
                  >
                    <div
                      className={`h-5 w-5 rounded-full bg-cream transition-transform ${
                        editBillable ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span className="text-[12px] text-sage">{t('projectRow.billable')}</span>
                  {editBillable && (
                    <input
                      type="number"
                      min={1}
                      value={editRate}
                      onChange={(e) => setEditRate(e.target.value)}
                      placeholder={t('projectRow.perHourPlaceholder')}
                      className="h-9 w-28 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                      title={t('projectRow.hourlyRateTitle')}
                    />
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="press rounded-lg px-3 py-1.5 text-[12px] text-faint hover:text-cream"
                  >
                    {t('projectRow.cancel')}
                  </button>
                  <button
                    onClick={saveEdit}
                    className="press btn-accent rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                  >
                    {t('projectRow.save')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setEditing(true);
                    setEditName(project.name);
                    setEditCategory(project.category);
                    setEditColor(project.color);
                    setEditTags(project.tags.join(', '));
                    setEditDeadline(
                      project.deadline ? new Date(project.deadline).toISOString().slice(0, 10) : '',
                    );
                    setEditBillable(project.billable === true);
                    setEditRate(
                      typeof project.hourlyRate === 'number' ? String(project.hourlyRate) : '',
                    );
                  }}
                  className="press rounded-lg bg-ink/60 px-2.5 py-1.5 text-[11px] font-semibold text-sage ring-1 ring-inset ring-line hover:text-cream"
                >
                  {t('projectRow.edit')}
                </button>
                <button
                  onClick={() => onClone(project.id)}
                  className="press flex items-center gap-1.5 rounded-lg bg-ink/60 px-2.5 py-1.5 text-[11px] font-semibold text-sage ring-1 ring-inset ring-line hover:text-cream"
                >
                  <CopyIcon /> {t('projectRow.duplicate')}
                </button>
                <button
                  onClick={() => onArchive(project.id, true)}
                  className="press flex items-center gap-1.5 rounded-lg bg-ink/60 px-2.5 py-1.5 text-[11px] font-semibold text-sage ring-1 ring-inset ring-line hover:text-cream"
                >
                  <ArchiveIcon /> {t('projectRow.archive')}
                </button>
                <button
                  onClick={() => onDelete(project.id)}
                  className="press ml-auto flex items-center gap-1.5 rounded-lg bg-ink/60 px-2.5 py-1.5 text-[11px] font-semibold text-faint ring-1 ring-inset ring-line hover:text-tomato"
                >
                  <TrashIcon /> {t('projectRow.delete')}
                </button>
              </div>
            )}
          </div>

          <div className="mt-3">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              {t('projectRow.docHeading')}
            </div>
            <textarea
              value={docDraft}
              onChange={(e) => setDocDraft(e.target.value)}
              onBlur={() =>
                onProjectsChange(updateProject(allProjects, project.id, { doc: docDraft || null }))
              }
              placeholder={t('projectRow.docPlaceholder')}
              rows={3}
              maxLength={4000}
              className="mt-1.5 w-full resize-y rounded-lg bg-ink/40 px-3 py-2 text-[12px] leading-relaxed text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
          </div>

          <LinkedItems
            entityType="project"
            entityId={project.id}
            links={links}
            onLinksChange={onLinksChange}
            goals={goals}
            projects={allProjects}
            skills={skills}
            objectives={objectives}
          />

          {/* tasks */}
          <div className="mt-3">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              {t('projectRow.tasksHeading')}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="text"
                value={newTaskTitle}
                maxLength={120}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder={t('projectRow.addTaskPlaceholder')}
                className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
              />
              <select
                value=""
                onChange={(e) => {
                  const tpl = TASK_TEMPLATES.find((x) => x.name === e.target.value);
                  if (tpl) {
                    setNewTaskTitle(tpl.title);
                    setNewTaskPriority(tpl.priority);
                  }
                }}
                className="h-9 shrink-0 rounded-lg bg-ink/40 px-2 text-[12px] text-faint ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title={t('projectRow.templateTitle')}
                aria-label={t('projectRow.templateLabel')}
              >
                <option value="">{t('projectRow.templatePlaceholder')}</option>
                {TASK_TEMPLATES.map((tpl) => (
                  <option key={tpl.name} value={tpl.name}>
                    {tpl.name}
                  </option>
                ))}
              </select>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                className="h-9 rounded-lg bg-ink/40 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title={t('projectRow.priorityTitle')}
              >
                {(['p0', 'p1', 'p2'] as const).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
              <button
                onClick={addTask}
                disabled={!newTaskTitle.trim()}
                className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg disabled:opacity-40"
                aria-label={t('projectRow.addTask')}
              >
                <PlusIcon />
              </button>
            </div>

            {selectedTaskIds.size > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-accent/10 p-2 ring-1 ring-inset ring-accent/30">
                <span className="font-mono text-[11px] text-accent">
                  {t('projectRow.bulkSelected', { n: selectedTaskIds.size })}
                </span>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) bulkApplyPriority(e.target.value as TaskPriority);
                  }}
                  className="h-8 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                  title={t('projectRow.bulkPriority')}
                >
                  <option value="">{t('projectRow.bulkPriority')}</option>
                  {(['p0', 'p1', 'p2', 'p3'] as const).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  onChange={(e) =>
                    bulkApplyDueAt(
                      e.target.value ? new Date(e.target.value + 'T12:00:00').getTime() : null,
                    )
                  }
                  className="h-8 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                  title={t('projectRow.bulkReschedule')}
                />
                <select
                  value={bulkMoveTarget}
                  onChange={(e) => setBulkMoveTarget(e.target.value)}
                  className="h-8 min-w-0 max-w-[140px] rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                  title={t('projectRow.bulkMove')}
                >
                  <option value="">{t('projectRow.bulkMove')}</option>
                  {allProjects
                    .filter((p) => p.id !== project.id && !p.archived)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={bulkApplyMove}
                  disabled={!bulkMoveTarget}
                  className="press btn-accent rounded-lg px-3 py-1.5 font-display text-[12px] font-bold disabled:opacity-40"
                >
                  {t('projectRow.bulkApplyMove')}
                </button>
                <button
                  onClick={clearSelection}
                  className="press ml-auto rounded-lg px-2 py-1.5 font-mono text-[11px] text-faint hover:text-cream"
                >
                  {t('projectRow.bulkClear')}
                </button>
              </div>
            )}

            <div className="mt-2 space-y-1">
              {projectTasks.length === 0 ? (
                <p className="rounded-lg bg-ink/30 px-3 py-2.5 text-[11px] text-faint">
                  {t('projectRow.noTasksYet')}
                </p>
              ) : (
                projectTasks.map((task, ti) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    tasks={tasks}
                    projectId={project.id}
                    depth={0}
                    wbs={String(ti + 1)}
                    ancestorIds={[]}
                    onTasksChange={onTasksChange}
                    selectedIds={selectedTaskIds}
                    onToggleSelect={toggleSelectTask}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-ink/40 px-2.5 py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div
        className="mt-0.5 font-mono text-[13px] font-semibold"
        style={accent ? { color: 'var(--accent)' } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function projectStats(history: Session[], projectId: string): ProjectStats {
  return getProjectStats(projectId, history);
}
