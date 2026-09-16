import { useMemo, useState } from 'react';
import type { Project, ProjectCategory, ProjectStats } from '../lib/projects';
import {
  PROJECT_COLORS,
  PROJECT_CATEGORIES,
  CATEGORY_LABELS,
  createProjectObject,
  cloneProject,
  deleteProject,
  updateProject,
  activeProjects,
  archivedProjects,
  FREE_PROJECTS_LIMIT,
  getProjectStats,
  getMinutesForProject,
  formatProjectDuration,
  parseTags,
  saveProjects,
} from '../lib/projects';
import type { Task, TaskStatus, TaskPriority } from '../lib/tasks';
import {
  createTaskObject,
  tasksForProject,
  updateTaskStatus,
  removeTask,
  setTaskPriority,
  projectCompletion,
  PRIORITY_LABELS,
  saveTasks,
} from '../lib/tasks';
import type { Session } from '../lib/store';
import type { FocusArea } from '../lib/focusAreas';
import { exportSessionsToCSV } from '../lib/export';

interface Props {
  projects: Project[];
  history: Session[];
  areas: FocusArea[];
  tasks: Task[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onProjectsChange: (projects: Project[]) => void;
  onTasksChange: (tasks: Task[]) => void;
  onUpgradeClick?: () => void;
  isPro?: boolean;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function ProjectsCard({
  projects,
  history,
  areas,
  tasks,
  selectedProjectId,
  onSelectProject,
  onProjectsChange,
  onTasksChange,
  onUpgradeClick,
  isPro = false,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState<ProjectCategory>('work');
  const [limitNotice, setLimitNotice] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState('');

  const active = activeProjects(projects);
  const archived = archivedProjects(projects);

  const filteredActive = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return active;
    return active.filter(
      (p) => p.name.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [active, filter]);

  const canCreate = isPro || projects.length < FREE_PROJECTS_LIMIT;

  const commitProjects = (next: Project[]) => {
    saveProjects(next);
    onProjectsChange(next);
  };

  const commitTasks = (next: Task[]) => {
    saveTasks(next);
    onTasksChange(next);
  };

  const handleToggleCreate = () => {
    if (!showCreate && !canCreate) {
      setLimitNotice(true);
      return;
    }
    setShowCreate(!showCreate);
    setLimitNotice(false);
  };

  const handleCreate = () => {
    if (!newProjectName.trim()) return;
    if (!canCreate) {
      setLimitNotice(true);
      return;
    }
    const newProject = createProjectObject(newProjectName.trim(), newProjectCategory);
    commitProjects([...projects, newProject]);
    onSelectProject(newProject.id);
    setExpandedId(newProject.id);
    setNewProjectName('');
    setShowCreate(false);
  };

  const handleDelete = (id: string) => {
    if (
      !confirm(
        'Delete this project? Its tasks will also be removed. (Session history is preserved.)',
      )
    )
      return;
    commitProjects(deleteProject(projects, id));
    commitTasks(tasks.filter((t) => t.projectId !== id));
    if (selectedProjectId === id) onSelectProject(null);
    if (expandedId === id) setExpandedId(null);
  };

  const handleArchive = (id: string, archivedValue: boolean) => {
    commitProjects(updateProject(projects, id, { archived: archivedValue }));
    if (archivedValue && selectedProjectId === id) onSelectProject(null);
  };

  const handleClone = (id: string) => {
    const src = projects.find((p) => p.id === id);
    if (!src) return;
    const copy = cloneProject(src);
    commitProjects([...projects, copy]);
    setExpandedId(copy.id);
  };

  const handleExport = () => {
    exportSessionsToCSV(history, projects, areas);
  };

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="Projects cabinet">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">Projects</h2>
          <p className="mt-0.5 text-[11px] text-faint">Track focus time by client or initiative</p>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={handleExport}
              title="Download CSV timesheet"
              className="press btn-ghost flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-mono text-[11px] text-sage hover:text-cream"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              CSV
            </button>
          )}
          <button
            onClick={handleToggleCreate}
            className="press text-[12px] font-semibold text-accent hover:opacity-80"
          >
            {showCreate ? 'Cancel' : '+ New Project'}
          </button>
        </div>
      </header>

      {limitNotice && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-semibold text-cream">
                Free limit reached ({FREE_PROJECTS_LIMIT} projects)
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-sage">
                Upgrade to Moneo Pro for unlimited projects, cloud sync, and advanced analytics.
              </p>
            </div>
            {onUpgradeClick && (
              <button
                onClick={onUpgradeClick}
                className="press btn-accent shrink-0 rounded-lg px-3 py-1.5 font-display text-[12px] font-bold"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="mt-4 space-y-3 rounded-xl border border-line bg-ink/60 p-4">
          <input
            type="text"
            value={newProjectName}
            maxLength={50}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="e.g. Client X App, Thesis, Mobile Redesign"
            className="w-full rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex items-center gap-3">
            <select
              value={newProjectCategory}
              onChange={(e) => setNewProjectCategory(e.target.value as ProjectCategory)}
              className="w-full rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
            >
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              disabled={!newProjectName.trim()}
              className="press btn-accent flex h-9 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="mt-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search projects or tags…"
            className="w-full rounded-lg bg-ink/40 px-3 py-2 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
          />
        </div>
      )}

      <div className="mt-4 space-y-2">
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line/60 py-7 text-center">
            <p className="text-sm text-faint">No projects created yet.</p>
            <p className="mt-1 text-[11px] text-faint">
              Create a project to organize and track billable time.
            </p>
          </div>
        ) : filteredActive.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line/60 py-6 text-center">
            <p className="text-[12px] text-faint">No projects match "{filter}".</p>
          </div>
        ) : (
          filteredActive.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              history={history}
              tasks={tasks}
              isSelected={selectedProjectId === project.id}
              isExpanded={expandedId === project.id}
              onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
              onSelect={() => onSelectProject(selectedProjectId === project.id ? null : project.id)}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onClone={handleClone}
              onProjectsChange={commitProjects}
              onTasksChange={commitTasks}
            />
          ))
        )}
      </div>

      {archived.length > 0 && (
        <div className="mt-4 border-t border-line/60 pt-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="press flex w-full items-center justify-between py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint hover:text-sage"
          >
            <span>Archived ({archived.length})</span>
            <ChevronIcon open={showArchived} />
          </button>
          {showArchived && (
            <div className="mt-2 space-y-1.5">
              {archived.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 opacity-70"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate text-[13px] font-medium text-cream/80">
                      {project.name}
                    </span>
                    <span className="font-mono text-[10px] text-faint">
                      {formatProjectDuration(getMinutesForProject(project.id, history))}
                    </span>
                  </div>
                  <button
                    onClick={() => handleArchive(project.id, false)}
                    className="press flex items-center gap-1 rounded p-1 text-[11px] text-faint hover:text-sage"
                    title="Restore project"
                  >
                    <UndoIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

interface ProjectRowProps {
  project: Project;
  history: Session[];
  tasks: Task[];
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onSelect: () => void;
  onDelete: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onClone: (id: string) => void;
  onProjectsChange: (next: Project[]) => void;
  onTasksChange: (next: Task[]) => void;
}

function ProjectRow({
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
  const projectTasks = tasksForProject(tasks, project.id);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editCategory, setEditCategory] = useState<string>(project.category);
  const [editColor, setEditColor] = useState(project.color);
  const [editTags, setEditTags] = useState(project.tags.join(', '));
  const [editDeadline, setEditDeadline] = useState(
    project.deadline ? new Date(project.deadline).toISOString().slice(0, 10) : '',
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
    onProjectsChange(
      updateProject([project], project.id, {
        name: editName,
        category: editCategory as ProjectCategory,
        color: editColor,
        tags: parseTags(editTags),
        deadline,
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

  const toggleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    onTasksChange(updateTaskStatus(tasks, taskId, nextStatus));
  };

  const changeTaskPriority = (taskId: string, priority: TaskPriority) => {
    onTasksChange(setTaskPriority(tasks, taskId, priority));
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
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="Tags: client, urgent (comma separated)"
                  className="w-full rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                />
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
                projectTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${
                      task.status === 'completed' ? 'opacity-55' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`press flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${
                        task.status === 'completed'
                          ? 'bg-accent text-on-accent ring-accent'
                          : 'bg-ink/60 text-transparent ring-line hover:text-sage'
                      }`}
                      aria-label={task.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}
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
                    <span
                      className={`truncate text-[13px] text-cream/90 ${
                        task.status === 'completed' ? 'line-through' : ''
                      }`}
                    >
                      {task.title}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <select
                        value={task.priority}
                        onChange={(e) =>
                          changeTaskPriority(task.id, e.target.value as TaskPriority)
                        }
                        className="rounded bg-ink/50 px-1.5 py-1 font-mono text-[10px] text-faint ring-1 ring-inset ring-line"
                        title="Priority"
                      >
                        {(['p0', 'p1', 'p2', 'p3'] as const).map((p) => (
                          <option key={p} value={p}>
                            {PRIORITY_LABELS[p]}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => onTasksChange(removeTask(tasks, task.id))}
                        className="press rounded p-1 text-faint hover:text-tomato"
                        aria-label={`Delete task ${task.title}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
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
