import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProjectCategory } from '../lib/projects';
import {
  activeProjects,
  archivedProjects,
  FREE_PROJECTS_LIMIT,
} from '../lib/projects';
import { exportSessionsToCSV } from '../lib/export';
import type { Props } from './projects/types';
import ProjectRow from './projects/ProjectRow';
import CreateProjectForm from './projects/CreateProjectForm';
import TemplateGallery from './projects/TemplateGallery';
import ArchivedSection from './projects/ArchivedSection';
import { useProjectsCrud } from './projects/useProjectsCrud';
import { useI18n } from '../lib/i18n/LocaleContext';

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
  const [showExportUpsell, setShowExportUpsell] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const i18n = useI18n();
  const { t, fmtNum } = i18n;

  const crud = useProjectsCrud({
    projects,
    tasks,
    selectedProjectId,
    onSelectProject,
    onProjectsChange,
    onTasksChange,
    isPro,
    deleteConfirmMessage: t('proj.delConfirm'),
    onCreated: (id) => setExpandedId(id),
  });
  const { canCreate, limitNotice, setLimitNotice, commitProjects, commitTasks } = crud;

  const active = activeProjects(projects);
  const archived = archivedProjects(projects);

  const filteredActive = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return active;
    return active.filter(
      (p) => p.name.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [active, filter]);

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
    if (crud.create(newProjectName, newProjectCategory)) {
      setNewProjectName('');
      setShowCreate(false);
    }
  };

  const handleInstantiate = (templateId: string) => {
    if (crud.instantiate(templateId)) {
      setShowTemplates(false);
    }
  };

  const handleDelete = (id: string) => {
    if (crud.remove(id) && expandedId === id) setExpandedId(null);
  };

  const handleExport = () => {
    exportSessionsToCSV(history, projects, areas, tasks, i18n, {
      isPro,
      onBlocked: () => setShowExportUpsell(true),
    });
  };

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('proj.aria')}>
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('proj.title')}
          </h2>
          <p className="mt-0.5 text-[12px] text-sage">{t('proj.sub')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {history.length > 0 && (
            <button
              onClick={handleExport}
              title={t('proj.csvTitle')}
              className="press btn-ghost flex h-9 items-center gap-1.5 rounded-lg px-3 font-mono text-[12px] font-semibold"
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
              {t('proj.csv')}
            </button>
          )}
          <button
            onClick={handleToggleTemplates}
            className="press btn-ghost h-9 rounded-lg px-3 text-[12px] font-semibold"
          >
            {showTemplates ? t('cal.cancel') : t('proj.tplShow')}
          </button>
          <button
            onClick={handleToggleCreate}
            className="press btn-accent h-9 rounded-lg px-3.5 text-[12px] font-bold"
          >
            {showCreate ? t('cal.cancel') : t('proj.new')}
          </button>
        </div>
      </header>

      {limitNotice && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-semibold text-cream">
                {t('proj.limit', { n: fmtNum(FREE_PROJECTS_LIMIT) })}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-sage">{t('proj.limitBody')}</p>
            </div>
            {onUpgradeClick && (
              <button
                onClick={onUpgradeClick}
                className="press btn-accent shrink-0 rounded-lg px-3 py-1.5 font-display text-[12px] font-bold"
              >
                {t('proj.upgrade')}
              </button>
            )}
          </div>
        </div>
      )}

      {showExportUpsell && !isPro && (
        <div role="alert" className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
          <div className="text-[13px] font-semibold text-cream">{t('rep.exportProTitle')}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-sage">{t('rep.exportProBody')}</p>
          <div className="mt-2 flex gap-2">
            {onUpgradeClick ? (
              <button
                onClick={onUpgradeClick}
                className="press btn-accent shrink-0 rounded-lg px-3 py-1.5 font-display text-[12px] font-bold"
              >
                {t('proj.upgrade')}
              </button>
            ) : (
              <Link
                to="/pricing"
                className="press btn-accent shrink-0 rounded-lg px-3 py-1.5 font-display text-[12px] font-bold"
              >
                {t('proj.upgrade')}
              </Link>
            )}
            <button
              onClick={() => setShowExportUpsell(false)}
              className="press btn-ghost shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold"
            >
              {t('cal.cancel')}
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateProjectForm
          name={newProjectName}
          onName={setNewProjectName}
          category={newProjectCategory}
          onCategory={setNewProjectCategory}
          onCreate={handleCreate}
        />
      )}

      {showTemplates && <TemplateGallery isPro={isPro} onInstantiate={handleInstantiate} />}

      {projects.length > 0 && (
        <div className="mt-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('proj.searchPh')}
            className="w-full rounded-lg bg-ink/40 px-3 py-2 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
          />
        </div>
      )}

      <div className="mt-4 space-y-2">
        {projects.length === 0 ? (
          <div className="empty-panel">
            <p className="text-sm font-medium text-cream">{t('proj.emptyA')}</p>
            <p className="mt-1.5 text-[12px] text-sage">{t('proj.emptyB')}</p>
            <button
              onClick={handleToggleCreate}
              className="press btn-accent mt-4 h-9 rounded-lg px-4 text-[12px] font-bold"
            >
              {t('proj.new')}
            </button>
          </div>
        ) : filteredActive.length === 0 ? (
          <div className="empty-panel py-6">
            <p className="text-[12px] text-sage">{t('proj.noMatch', { q: filter })}</p>
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
              onArchive={crud.setArchived}
              onClone={crud.clone}
              onProjectsChange={commitProjects}
              onTasksChange={commitTasks}
            />
          ))
        )}
      </div>

      <ArchivedSection
        archived={archived}
        history={history}
        onRestore={(id) => crud.setArchived(id, false)}
      />
    </section>
  );
}
