import type { Project } from '../../lib/projects';
import type { Session } from '../../lib/store';
import type { FocusArea } from '../../lib/focusAreas';
import type { Task } from '../../lib/tasks';
import type { EntityLink } from '../../lib/entityLinks';
import type { Goal } from '../../lib/goals';
import type { Skill } from '../../lib/skills';
import type { SavedFilter } from '../../lib/savedFilters';
import type { Objective } from '../../lib/okrs';

export interface Props {
  projects: Project[];
  history: Session[];
  areas: FocusArea[];
  tasks: Task[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onProjectsChange: (projects: Project[]) => void;
  onTasksChange: (tasks: Task[]) => void;
  links: EntityLink[];
  onLinksChange: (links: EntityLink[]) => void;
  goals: Goal[];
  skills: Skill[];
  objectives: Objective[];
  onUpgradeClick?: () => void;
  isPro?: boolean;
  savedFilters: SavedFilter[];
  onSavedFiltersChange: (filters: SavedFilter[]) => void;
}

export interface ProjectRowProps {
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
  links: EntityLink[];
  onLinksChange: (links: EntityLink[]) => void;
  goals: Goal[];
  allProjects: Project[];
  skills: Skill[];
  objectives: Objective[];
}

export interface TaskRowProps {
  task: Task;
  tasks: Task[];
  projectId: string;
  depth: number;
  /** WBS number like "2.1.3". */
  wbs: string;
  ancestorIds: string[];
  onTasksChange: (next: Task[]) => void;
  /** Bulk-action selection (Faza 28) — omitted entirely, no checkbox renders. */
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}
