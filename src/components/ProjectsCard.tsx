import { useMemo, useState } from 'react';
import type { Project } from '../lib/projects';
import type { ProjectCategory } from '../lib/projects';
import {
  PROJECT_CATEGORIES,
  CATEGORY_LABELS,
  createProjectObject,
  cloneProject,
  deleteProject,
  updateProject,
  activeProjects,
  archivedProjects,
  FREE_PROJECTS_LIMIT,
  getMinutesForProject,
  formatProjectDuration,
  saveProjects,
} from '../lib/projects';
import type { Task } from '../lib/tasks';
import { saveTasks } from '../lib/tasks';
import { exportSessionsToCSV } from '../lib/export';
import {
  PROJECT_TEMPLATES,
  availableTemplates,
  getTemplateById,
  instantiateTemplate,
} from '../lib/projectTemplates';
import { ChevronIcon, UndoIcon } from './projects/icons';
import type { Props } from './projects/types';
import ProjectRow from './projects/ProjectRow';

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
