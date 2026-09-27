/**
 * Compose Project + Waterfall + Tasks when approving a BuiltPath / Roadmap.
 */
import { createProjectObject, type Project, type ProjectCategory } from '../projects';
import { createTaskObject, setTaskEstimate, type Task } from '../tasks';
import {
  seedPhasesForProject,
  setPhaseStatus,
  type WaterfallPackId,
  type WaterfallPhase,
} from '../waterfall';
import { saveAdvancedPlanning } from '../advancedPlanning';
import { detectKind } from './planner';
import type { PathKind } from './types';
import {
  groupPreferredKind,
  nextOpenStep,
  recalcRoadmap,
  type Roadmap,
  type RoadmapGroup,
} from './roadmap';

export function packForKind(kind: PathKind): WaterfallPackId {
  return kind === 'build' ? 'build' : 'software';
}

export function categoryForGroup(group: RoadmapGroup): ProjectCategory {
  switch (group) {
    case 'ship':
    case 'market':
      return 'work';
    case 'build':
    case 'learn':
    case 'write':
    case 'life':
    case 'custom':
      return 'learning';
  }
}

export function kindForRoadmap(r: Roadmap): PathKind {
  return groupPreferredKind(r.group) ?? detectKind(r.title);
}

export interface ApproveRoadmapComposeInput {
  roadmap: Roadmap;
  projects: Project[];
  tasks: Task[];
  phases: WaterfallPhase[];
  /** Recent focus minutes/day; when >= 5, stamps actual pace. */
  paceMinPerDay?: number;
}

export interface ApproveRoadmapComposeResult {
  roadmap: Roadmap;
  projects: Project[];
  tasks: Task[];
  phases: WaterfallPhase[];
  projectId: string;
  focusTaskId: string | null;
}

/** Approve a roadmap: project + waterfall pack + tasks linked on steps. */
export function approveRoadmapCompose(
  input: ApproveRoadmapComposeInput,
): ApproveRoadmapComposeResult {
  const kind = kindForRoadmap(input.roadmap);
  const pack = packForKind(kind);
  const project = createProjectObject(
    input.roadmap.title.slice(0, 60),
    categoryForGroup(input.roadmap.group),
  );
  let nextTasks = input.tasks;
  const steps = input.roadmap.steps.map((step, i) => {
    const task = createTaskObject(project.id, step.title, i === 0 ? 'p1' : 'p2');
    nextTasks = [...nextTasks, task];
    nextTasks = setTaskEstimate(nextTasks, task.id, step.estimateMin);
    return { ...step, taskId: task.id };
  });
  let stamped: Roadmap = {
    ...input.roadmap,
    projectId: project.id,
    steps,
    updatedAt: Date.now(),
  };
  if (input.paceMinPerDay != null && input.paceMinPerDay >= 5) {
    stamped = recalcRoadmap(stamped, input.paceMinPerDay);
  }
  let phases = seedPhasesForProject(input.phases, project.id, pack);
  if (phases !== input.phases) {
    saveAdvancedPlanning(true);
    // Activate the first gate so Agile Waterfall is already in motion.
    const first = phases.find((p) => p.projectId === project.id && p.order === 0);
    if (first) phases = setPhaseStatus(phases, first.id, 'active');
  }
  const focus = nextOpenStep(stamped);
  return {
    roadmap: stamped,
    projects: [...input.projects, project],
    tasks: nextTasks,
    phases,
    projectId: project.id,
    focusTaskId: focus?.taskId ?? null,
  };
}

/** Seed waterfall for an AiPath-approved project when kind warrants it. */
export function seedWaterfallForPathKind(
  phases: WaterfallPhase[],
  projectId: string,
  kind: PathKind,
): WaterfallPhase[] {
  const next = seedPhasesForProject(phases, projectId, packForKind(kind));
  if (next !== phases) saveAdvancedPlanning(true);
  return next;
}
