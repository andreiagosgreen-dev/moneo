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
} from '../../lib/tasks';
import type { Session } from '../../lib/store';
import { ChevronIcon, TrashIcon, CopyIcon, ArchiveIcon, PlusIcon } from './icons';
import type { ProjectRowProps } from './types';
import TaskRow from './TaskRow';

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
}: ProjectRowProps) {
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

  const [newTaskTitle, setNewTaskTitle] = useState('');
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
                  Active
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-faint">
              <span className="capitalize">
                {CATEGORY_LABELS[project.category as ProjectCategory]}
              </span>
              <span>·</span>
              <span className="font-mono text-sage">{timeFormatted}</span>
              {completion.total > 0 && (
                <>
                  <span>·</span>
                  <span className="font-mono">
                    {completion.done}/{completion.total} tasks
                  </span>
                </>
              )}
            </div>
            {project.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {project.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] text-faint"
                  >
                    #{t}
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
            title={isExpanded ? 'Collapse' : 'Expand'}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${project.name}`}
          >
            <ChevronIcon open={isExpanded} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-line/60 px-3.5 pb-4 pt-3">
          {/* stats mini-panel */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Time" value={timeFormatted} accent />
            <Stat label="Sessions" value={String(projectStats(history, project.id).sessions)} />
            <Stat label="Tasks done" value={`${completion.done}/${completion.total || '—'}`} />
            {project.billable === true && (
              <Stat
                label="Billable"
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
                      aria-label={`Set color ${c}`}
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
                        {CATEGORY_LABELS[c]}
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
                      title="Suggest a deadline from measured velocity (+20% buffer)"
                    >
                      Auto
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="Tags: client, urgent (comma separated)"
                  className="w-full rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditBillable(!editBillable)}
                    className={`press flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                      editBillable ? 'bg-accent' : 'bg-line/50'
                    }`}
                    aria-pressed={editBillable}
                    title="Billable client work"
                  >
                    <div
                      className={`h-5 w-5 rounded-full bg-cream transition-transform ${
                        editBillable ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span className="text-[12px] text-sage">Billable</span>
                  {editBillable && (
                    <input
                      type="number"
                      min={1}
                      value={editRate}
                      onChange={(e) => setEditRate(e.target.value)}
                      placeholder="$/hour"
                      className="h-9 w-28 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                      title="Hourly rate (USD)"
                    />
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="press rounded-lg px-3 py-1.5 text-[12px] text-faint hover:text-cream"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className="press btn-accent rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                  >
                    Save
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
                  Edit
                </button>
                <button
                  onClick={() => onClone(project.id)}
                  className="press flex items-center gap-1.5 rounded-lg bg-ink/60 px-2.5 py-1.5 text-[11px] font-semibold text-sage ring-1 ring-inset ring-line hover:text-cream"
                >
                  <CopyIcon /> Duplicate
                </button>
                <button
                  onClick={() => onArchive(project.id, true)}
                  className="press flex items-center gap-1.5 rounded-lg bg-ink/60 px-2.5 py-1.5 text-[11px] font-semibold text-sage ring-1 ring-inset ring-line hover:text-cream"
                >
                  <ArchiveIcon /> Archive
                </button>
                <button
                  onClick={() => onDelete(project.id)}
                  className="press ml-auto flex items-center gap-1.5 rounded-lg bg-ink/60 px-2.5 py-1.5 text-[11px] font-semibold text-faint ring-1 ring-inset ring-line hover:text-tomato"
                >
                  <TrashIcon /> Delete
                </button>
              </div>
            )}
          </div>

          {/* tasks */}
          <div className="mt-3">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              Tasks
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="text"
                value={newTaskTitle}
                maxLength={120}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add a task…"
                className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
              />
              <select
                value=""
                onChange={(e) => {
                  const tpl = TASK_TEMPLATES.find((t) => t.name === e.target.value);
                  if (tpl) {
                    setNewTaskTitle(tpl.title);
                    setNewTaskPriority(tpl.priority);
                  }
                }}
                className="h-9 shrink-0 rounded-lg bg-ink/40 px-2 text-[12px] text-faint ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title="Start from a task template"
                aria-label="Task template"
              >
                <option value="">Tpl…</option>
                {TASK_TEMPLATES.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                className="h-9 rounded-lg bg-ink/40 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title="Priority"
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
                aria-label="Add task"
              >
                <PlusIcon />
              </button>
            </div>

            <div className="mt-2 space-y-1">
              {projectTasks.length === 0 ? (
                <p className="rounded-lg bg-ink/30 px-3 py-2.5 text-[11px] text-faint">
                  No tasks yet. Add a task and select it in the timer to track time per task.
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
