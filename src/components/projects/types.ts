import type { Project } from '../../lib/projects';
import type { Session } from '../../lib/store';
import type { FocusArea } from '../../lib/focusAreas';
import type { Task } from '../../lib/tasks';

export interface Props {
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
}
