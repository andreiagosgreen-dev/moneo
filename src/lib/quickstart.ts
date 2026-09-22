/* First-run quickstart (progress companion onboarding).
 *
 * Turns one goal sentence into a working setup: a project, a first task
 * for today (suggested rule-based via suggestTasksForGoal when the user
 * doesn't type their own) and a goal linked to that project — so the very
 * first focus round already renders a Progress Meter payoff.
 *
 * Pure object builders; persistence + selection stay with the caller
 * (App). Respects Free caps through `createProject`/`createGoal` flags:
 * when a cap is hit the caller passes an existing project to attach to
 * and/or skips the goal — the session payoff still works on the project.
 * Never throws.
 */
import { createProjectObject, type Project } from './projects';
import { createTaskObject, type Task } from './tasks';
import { createGoalObject, suggestTasksForGoal, type Goal } from './goals';

export interface QuickStartPlan {
  /** Null when the goal cap is hit — project progress still pays off. */
  goal: Goal | null;
  project: Project;
  /** True when the project was minted here (caller persists it). */
  createdProject: boolean;
  task: Task;
}

export interface QuickStartInput {
  goalTitle: string;
  taskTitle?: string;
  /** Reuse when the project cap is hit; otherwise a project is minted. */
  existingProject?: Project | null;
  /** False when the goal cap is hit. Defaults to true. */
  createGoal?: boolean;
}

const FALLBACK_TASK = 'Take the first concrete step';

/**
 * Build the quickstart objects. Returns null for a blank goal title —
 * the UI disables Next in that case, so this is a backstop.
 */
export function planQuickStart(input: QuickStartInput): QuickStartPlan | null {
  const cleanGoal = input.goalTitle.trim().slice(0, 80);
  if (!cleanGoal) return null;
  const cleanTask = (input.taskTitle ?? '').trim().slice(0, 80);
  const taskTitle =
    cleanTask || suggestTasksForGoal(cleanGoal)[0] || FALLBACK_TASK;

  const createdProject = !input.existingProject;
  const project = input.existingProject ?? createProjectObject(cleanGoal.slice(0, 60), 'personal');
  const task = createTaskObject(project.id, taskTitle, 'p1');

  let goal: Goal | null = null;
  if (input.createGoal !== false) {
    const draft = createGoalObject([], cleanGoal, 'project');
    if (draft) goal = { ...draft, projectId: project.id, updatedAt: Date.now() };
  }
  return { goal, project, createdProject, task };
}
