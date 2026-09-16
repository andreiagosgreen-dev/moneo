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
  billableAmount,
  formatBillable,
  parseTags,
  saveProjects,
} from '../lib/projects';
import type { Task, TaskStatus, TaskPriority, TaskRecurrence } from '../lib/tasks';
import {
  createTaskObject,
  createSubtaskObject,
  canNest,
  rootTasks,
  subtasksOf,
  completeTask,
  updateTaskStatus,
  setBlockedBy,
  blockingTasks,
  canComplete,
  setRecurrence,
  setDueAt,
  setNotes,
  setTaskPoints,
  removeTask,
  setTaskPriority,
  projectCompletion,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_RECURRENCES,
  TASK_POINTS,
  saveTasks,
} from '../lib/tasks';
import type { Session } from '../lib/store';
import type { FocusArea } from '../lib/focusAreas';
import { exportSessionsToCSV } from '../lib/export';
import {
  PROJECT_TEMPLATES,
  availableTemplates,
  getTemplateById,
  instantiateTemplate,
} from '../lib/projectTemplates';

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
  const [showTemplates, setShowTemplates] = useState(false);
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
    setShowTemplates(false);
    setLimitNotice(false);
  };

  const handleToggleTemplates = () => {
    setShowTemplates(!showTemplates);
    setShowCreate(false);
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

  const handleInstantiate = (templateId: string) => {
    const template = getTemplateById(templateId);
    if (!template || (template.pro && !isPro)) return;
    if (!canCreate) {
      setLimitNotice(true);
      return;
    }
    const { project, tasks: starter } = instantiateTemplate(template);
    commitProjects([...projects, project]);
    commitTasks([...tasks, ...starter]);
    onSelectProject(project.id);
    setExpandedId(project.id);
    setShowTemplates(false);
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
            onClick={handleToggleTemplates}
            className="press text-[12px] font-semibold text-sage hover:text-cream"
          >
            {showTemplates ? 'Cancel' : '◇ Template'}
          </button>
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

      {showTemplates && (
        <div className="mt-4 space-y-2 rounded-xl border border-line bg-ink/60 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            Start from a blueprint · {availableTemplates(isPro).length}/{PROJECT_TEMPLATES.length}{' '}
            available
          </p>
          {PROJECT_TEMPLATES.map((t) => {
            const locked = t.pro && !isPro;
            return (
              <div
                key={t.id}
                className={`rounded-lg px-3 py-2.5 ring-1 ring-inset ${
                  locked ? 'bg-ink/20 ring-line/50' : 'bg-ink/40 ring-line'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-semibold text-cream">{t.name}</span>
                    <span className="ml-2 font-mono text-[10px] text-faint">
                      {t.tasks.length} tasks · {t.stack.slice(0, 3).join(' · ')}
                    </span>
                  </div>
                  {locked ? (
                    <span
                      className="shrink-0 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-accent ring-1 ring-inset ring-accent/40"
                      title="Pro template — upgrade to use this blueprint"
                    >
                      Pro
                    </span>
                  ) : (
                    <button
                      onClick={() => handleInstantiate(t.id)}
                      className="press shrink-0 rounded-md px-2.5 py-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
                    >
                      Use
                    </button>
                  )}
                </div>
                <p className="mt-1 truncate text-[11px] text-faint" title={t.description}>
                  {t.description}
                </p>
                <details className="mt-1">
                  <summary className="cursor-pointer font-mono text-[10px] text-sage hover:text-cream">
                    Practices & pitfalls
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {t.bestPractices.map((b) => (
                      <li key={b} className="text-[11px] text-sage">
                        ✓ {b}
                      </li>
                    ))}
                    {t.pitfalls.map((p) => (
                      <li key={p} className="text-[11px] text-faint">
                        ✕ {p}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            );
          })}
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
                  <TaskRow
                    key={task.id}
                    task={task}
                    tasks={tasks}
                    projectId={project.id}
                    depth={0}
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

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDue(dueAt: number): string {
  return new Date(dueAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  none: 'Once',
  daily: 'Daily',
  weekly: 'Weekly',
};

interface TaskRowProps {
  task: Task;
  tasks: Task[];
  projectId: string;
  depth: number;
  ancestorIds: string[];
  onTasksChange: (next: Task[]) => void;
}

/** Recursive task row: nesting, blockers, recurrence, due dates, notes. */
function TaskRow({ task, tasks, projectId, depth, ancestorIds, onTasksChange }: TaskRowProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [subDraft, setSubDraft] = useState('');
  const [blockerPick, setBlockerPick] = useState('');

  const done = task.status === 'completed';
  const gate = canComplete(task, tasks);
  const blockers = blockingTasks(task, tasks);
  // Ancestor guard: legacy cycles can never infinite-loop the render.
  const children = subtasksOf(tasks, task.id).filter((c) => !ancestorIds.includes(c.id));
  const nestable = canNest(tasks, task.id, projectId);
  const candidates = tasks.filter(
    (t) => t.projectId === projectId && t.id !== task.id && !(task.blockedBy ?? []).includes(t.id),
  );
  const overdue = task.dueAt !== undefined && !done && task.dueAt < startOfToday();

  const toggle = () => {
    if (done) {
      onTasksChange(updateTaskStatus(tasks, task.id, 'pending'));
      return;
    }
    const { tasks: next } = completeTask(tasks, task.id);
    onTasksChange(next);
  };

  const addSubtask = () => {
    const child = createSubtaskObject(tasks, task.id, subDraft);
    if (!child) return;
    onTasksChange([...tasks, child]);
    setSubDraft('');
  };

  const addBlocker = () => {
    if (!blockerPick) return;
    onTasksChange(setBlockedBy(tasks, task.id, [...(task.blockedBy ?? []), blockerPick]));
    setBlockerPick('');
  };

  return (
    <div style={depth > 0 ? { marginLeft: depth * 16 } : undefined}>
      <div
        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${
          done ? 'opacity-55' : ''
        } ${depth > 0 ? 'border-l-2 border-line/60' : ''}`}
      >
        <button
          onClick={toggle}
          disabled={!done && !gate.ok}
          className={`press flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset disabled:cursor-not-allowed disabled:opacity-40 ${
            done
              ? 'bg-accent text-on-accent ring-accent'
              : 'bg-ink/60 text-transparent ring-line hover:text-sage'
          }`}
          aria-label={done ? 'Mark incomplete' : 'Mark complete'}
          title={!done && !gate.ok ? `Blocked by: ${gate.blockers.join(', ')}` : undefined}
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
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`min-w-0 flex-1 truncate text-left text-[13px] text-cream/90 hover:text-cream ${
            done ? 'line-through' : ''
          }`}
          title={task.notes ?? task.title}
        >
          {task.title}
        </button>
        {!done && blockers.length > 0 && (
          <span
            className="shrink-0 rounded bg-tomato/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-tomato"
            title={`Blocked by: ${gate.blockers.join(', ')}`}
          >
            ⛔ {blockers.length}
          </span>
        )}
        {task.recurrence && task.recurrence !== 'none' && (
          <span
            className="shrink-0 rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-sage ring-1 ring-inset ring-line"
            title={`Repeats ${task.recurrence}`}
          >
            ↻ {task.recurrence === 'daily' ? 'D' : 'W'}
          </span>
        )}
        {typeof task.points === 'number' && (
          <span
            className="shrink-0 rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[9px] text-sage ring-1 ring-inset ring-line"
            title="Story points"
          >
            {task.points}pt
          </span>
        )}
        {task.dueAt !== undefined && (
          <span
            className={`shrink-0 font-mono text-[10px] ${overdue ? 'font-bold text-tomato' : 'text-faint'}`}
            title={new Date(task.dueAt).toLocaleDateString()}
          >
            {formatDue(task.dueAt)}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <select
            value={task.priority}
            onChange={(e) =>
              onTasksChange(setTaskPriority(tasks, task.id, e.target.value as TaskPriority))
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
            onClick={() => setShowDetails(!showDetails)}
            className="press rounded p-1 font-mono text-[11px] text-faint hover:text-cream"
            aria-label={`${showDetails ? 'Hide' : 'Show'} details for ${task.title}`}
            title="Details: notes, due date, recurrence, blockers, subtasks"
          >
            ⋯
          </button>
          <button
            onClick={() => onTasksChange(removeTask(tasks, task.id))}
            className="press rounded p-1 text-faint hover:text-tomato"
            aria-label={`Delete task ${task.title}`}
            title={children.length > 0 ? `Deletes ${children.length} subtask(s) too` : undefined}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {showDetails && (
        <div
          className="mb-1 space-y-2 rounded-lg bg-ink/30 px-2.5 py-2.5"
          style={depth > 0 ? { marginLeft: 0 } : undefined}
        >
          {/* status + due + recurrence */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={task.status}
              onChange={(e) =>
                onTasksChange(updateTaskStatus(tasks, task.id, e.target.value as TaskStatus))
              }
              className="h-8 rounded-lg bg-ink/50 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              title="Workflow status"
            >
              {(['pending', 'in_progress', 'blocked'] as const).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
              <option value="completed">{STATUS_LABELS.completed}</option>
            </select>
            <input
              type="date"
              value={task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : ''}
              onChange={(e) =>
                onTasksChange(
                  setDueAt(
                    tasks,
                    task.id,
                    e.target.value ? new Date(e.target.value + 'T12:00:00').getTime() : null,
                  ),
                )
              }
              className="h-8 rounded-lg bg-ink/50 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              title="Due date"
            />
            <select
              value={task.recurrence ?? 'none'}
              onChange={(e) =>
                onTasksChange(setRecurrence(tasks, task.id, e.target.value as TaskRecurrence))
              }
              className="h-8 rounded-lg bg-ink/50 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              title="Recurrence"
            >
              {TASK_RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABELS[r]}
                </option>
              ))}
            </select>
            <select
              value={typeof task.points === 'number' ? task.points : ''}
              onChange={(e) =>
                onTasksChange(
                  setTaskPoints(
                    tasks,
                    task.id,
                    e.target.value === '' ? null : Number(e.target.value),
                  ),
                )
              }
              className="h-8 rounded-lg bg-ink/50 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              title="Story points"
            >
              <option value="">— pt</option>
              {TASK_POINTS.map((p) => (
                <option key={p} value={p}>
                  {p} pt
                </option>
              ))}
            </select>
          </div>

          {/* notes */}
          <textarea
            key={`notes-${task.id}-${task.updatedAt}`}
            defaultValue={task.notes ?? ''}
            maxLength={2000}
            rows={2}
            onBlur={(e) => {
              if ((e.target.value.trim() || '') !== (task.notes ?? '')) {
                onTasksChange(setNotes(tasks, task.id, e.target.value));
              }
            }}
            placeholder="Notes… (saved on blur)"
            className="w-full resize-y rounded-lg bg-ink/50 px-2.5 py-2 text-[12px] leading-relaxed text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
          />

          {/* blockers */}
          <div>
            {blockers.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {blockers.map((b) => (
                  <span
                    key={b.id}
                    className="flex items-center gap-1 rounded-full bg-tomato/15 px-2 py-0.5 font-mono text-[10px] text-tomato"
                  >
                    ⛔ {b.title}
                    <button
                      onClick={() =>
                        onTasksChange(
                          setBlockedBy(
                            tasks,
                            task.id,
                            (task.blockedBy ?? []).filter((id) => id !== b.id),
                          ),
                        )
                      }
                      className="press hover:text-cream"
                      aria-label={`Remove blocker ${b.title}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            {candidates.length > 0 && (
              <div className="flex items-center gap-1.5">
                <select
                  value={blockerPick}
                  onChange={(e) => setBlockerPick(e.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-lg bg-ink/50 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                  title="Must complete first"
                >
                  <option value="">Blocked by…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addBlocker}
                  disabled={!blockerPick}
                  className="press h-8 shrink-0 rounded-lg px-2.5 text-[12px] text-sage ring-1 ring-inset ring-line hover:text-cream disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* subtask */}
          {nestable ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={subDraft}
                maxLength={120}
                onChange={(e) => setSubDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                placeholder="Add a subtask…"
                className="h-8 min-w-0 flex-1 rounded-lg bg-ink/50 px-2.5 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
              />
              <button
                onClick={addSubtask}
                disabled={!subDraft.trim()}
                className="press btn-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-base font-bold disabled:opacity-40"
                aria-label="Add subtask"
              >
                +
              </button>
            </div>
          ) : (
            <p className="font-mono text-[10px] text-faint">
              Max nesting depth ({children.length} subtask{children.length === 1 ? '' : 's'}).
            </p>
          )}
        </div>
      )}

      {/* children */}
      {children.map((child) => (
        <TaskRow
          key={child.id}
          task={child}
          tasks={tasks}
          projectId={projectId}
          depth={depth + 1}
          ancestorIds={[...ancestorIds, task.id]}
          onTasksChange={onTasksChange}
        />
      ))}
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
