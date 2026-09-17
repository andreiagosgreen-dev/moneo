import type { Project } from '../../lib/projects';
import type { Task } from '../../lib/tasks';
import type { Sprint } from '../../lib/sprints';
import type { WaterfallPhase } from '../../lib/waterfall';
import type { BoardConfig } from '../../lib/sprints';

export type AgileTab = 'board' | 'sprints' | 'timeline' | 'waterfall';

export interface AgileProps {
  projects: Project[];
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  sprints: Sprint[];
  sprintsChange: (sprints: Sprint[]) => void;
  phases: WaterfallPhase[];
  phasesChange: (phases: WaterfallPhase[]) => void;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  isPro?: boolean;
}

export interface BoardProps {
  projectId: string | null;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  board: BoardConfig;
  commitBoard: (board: BoardConfig) => void;
  isPro: boolean;
}

export interface SprintsProps {
  projectId: string | null;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  sprints: Sprint[];
  sprintsChange: (sprints: Sprint[]) => void;
  isPro: boolean;
}

export interface TimelineProps {
  projectId: string | null;
  tasks: Task[];
}

export interface WaterfallProps {
  projectId: string | null;
  phases: WaterfallPhase[];
  phasesChange: (phases: WaterfallPhase[]) => void;
}
