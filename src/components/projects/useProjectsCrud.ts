import { useState } from 'react';
import type { Project, ProjectCategory } from '../../lib/projects';
import {
  createProjectObject,
  cloneProject,
  deleteProject,
  updateProject,
  FREE_PROJECTS_LIMIT,
  saveProjects,
} from '../../lib/projects';
import type { Task } from '../../lib/tasks';
import { saveTasks } from '../../lib/tasks';
import { getTemplateById, instantiateTemplate } from '../../lib/projectTemplates';
import {
  seedPhasesForProject,
  type WaterfallPhase,
} from '../../lib/waterfall';
import { saveAdvancedPlanning } from '../../lib/advancedPlanning';

export interface ProjectsCrudOptions {
  projects: Project[];
  tasks: Task[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onProjectsChange: (projects: Project[]) => void;
  onTasksChange: (tasks: Task[]) => void;
  isPro: boolean;
  /** Localized confirmation copy for project deletion. */
  deleteConfirmMessage: string;
  /** Called after a create/clone so the card can expand the new row. */
  onCreated: (id: string) => void;
  phases?: WaterfallPhase[];
  onPhasesChange?: (phases: WaterfallPhase[]) => void;
}

/**
 * All ProjectsCard mutations in one hook (moved verbatim from the card):
 * create, instantiate template, delete, archive/restore and clone,
 * including the Free-plan cap notice. Persistence + parent state updates
 * stay in lockstep exactly as before.
 */
export function useProjectsCrud({
  projects,
  tasks,
  selectedProjectId,
  onSelectProject,
  onProjectsChange,
  onTasksChange,
  isPro,
  deleteConfirmMessage,
  onCreated,
  phases = [],
  onPhasesChange,
}: ProjectsCrudOptions) {
  const [limitNotice, setLimitNotice] = useState(false);

  const canCreate = isPro || projects.length < FREE_PROJECTS_LIMIT;

  const commitProjects = (next: Project[]) => {
    saveProjects(next);
    onProjectsChange(next);
  };

  const commitTasks = (next: Task[]) => {
    saveTasks(next);
    onTasksChange(next);
  };

  const create = (name: string, category: ProjectCategory): boolean => {
    if (!name.trim()) return false;
    if (!canCreate) {
      setLimitNotice(true);
      return false;
    }
    const newProject = createProjectObject(name.trim(), category);
    commitProjects([...projects, newProject]);
    onSelectProject(newProject.id);
    onCreated(newProject.id);
    return true;
  };

  const instantiate = (templateId: string): boolean => {
    const template = getTemplateById(templateId);
    if (!template || (template.pro && !isPro)) return false;
    if (!canCreate) {
      setLimitNotice(true);
      return false;
    }
    const { project, tasks: starter } = instantiateTemplate(template);
    commitProjects([...projects, project]);
    commitTasks([...tasks, ...starter]);
    if (template.id === 'diy-hardware' && onPhasesChange) {
      const next = seedPhasesForProject(phases, project.id, 'build');
      if (next !== phases) {
        saveAdvancedPlanning(true);
        onPhasesChange(next);
      }
    }
    onSelectProject(project.id);
    onCreated(project.id);
    return true;
  };

  const remove = (id: string): boolean => {
    if (!confirm(deleteConfirmMessage)) return false;
    commitProjects(deleteProject(projects, id));
    commitTasks(tasks.filter((t) => t.projectId !== id));
    if (selectedProjectId === id) onSelectProject(null);
    return true;
  };

  const setArchived = (id: string, archivedValue: boolean) => {
    commitProjects(updateProject(projects, id, { archived: archivedValue }));
    if (archivedValue && selectedProjectId === id) onSelectProject(null);
  };

  const clone = (id: string) => {
    const src = projects.find((p) => p.id === id);
    if (!src) return;
    const copy = cloneProject(src);
    commitProjects([...projects, copy]);
    onCreated(copy.id);
  };

  return {
    canCreate,
    limitNotice,
    setLimitNotice,
    commitProjects,
    commitTasks,
    create,
    instantiate,
    remove,
    setArchived,
    clone,
  };
}
