/**
 * Calm progress-partner lines (Faza 6 coach role).
 *
 * No shaming, no generic praise: every line names the specific next step
 * and links effort to the goal. Functions return {key, vars} pairs — the
 * UI translates them, so tests assert structure, never language.
 */

import type { CoachLine } from './types';

/** Morning: one short recommendation grounded in real availability. */
export function morningBrief(args: {
  freeMinutes: number;
  unblockTask?: string | null;
  firstMeetingInMin?: number | null;
}): CoachLine {
  const task = (args.unblockTask ?? '').trim();
  if (task) {
    return {
      key: 'ai.coach.morningTask',
      vars: { minutes: Math.max(5, Math.round(args.freeMinutes)), task },
    };
  }
  return {
    key: 'ai.coach.morningFree',
    vars: { minutes: Math.max(5, Math.round(args.freeMinutes)) },
  };
}

/** Before a block: task + intention + the first concrete physical step. */
export function blockBrief(taskTitle: string, firstStep: string): CoachLine {
  return {
    key: 'ai.coach.block',
    vars: { task: taskTitle.trim().slice(0, 80), step: firstStep.trim().slice(0, 80) },
  };
}

/** Blocked: propose the smaller version — 10 minutes, one Pomodoro. */
export function shrinkSuggestion(taskTitle: string): CoachLine {
  return { key: 'ai.coach.shrink', vars: { task: taskTitle.trim().slice(0, 80) } };
}

/** After a session: specific recognition tied to the goal, never hollow. */
export function postSessionLine(args: {
  feedback: 'done' | 'continue' | 'blocked' | 'misestimated';
  taskTitle: string;
  goalTitle?: string | null;
}): CoachLine {
  const task = args.taskTitle.trim().slice(0, 80);
  const goal = (args.goalTitle ?? '').trim().slice(0, 60);
  switch (args.feedback) {
    case 'done':
      return goal
        ? { key: 'ai.coach.doneGoal', vars: { task, goal } }
        : { key: 'ai.coach.done', vars: { task } };
    case 'continue':
      return { key: 'ai.coach.continue', vars: { task } };
    case 'blocked':
      return { key: 'ai.coach.blocked', vars: { task } };
    case 'misestimated':
      return { key: 'ai.coach.misestimated', vars: { task } };
  }
}

/** After absence: gentle replan — one important 25-minute step, not catch-up. */
export function absenceLine(missedBlocks: number): CoachLine {
  return {
    key: 'ai.coach.absence',
    vars: { n: Math.max(1, Math.round(missedBlocks)) },
  };
}

/** Weekly review: real progress, obstacle, next decision. */
export function reviewLine(doneCount: number, blockedCount: number): CoachLine {
  return {
    key: doneCount > 0 && blockedCount === 0 ? 'ai.coach.reviewClean' : 'ai.coach.reviewMixed',
    vars: { done: Math.max(0, doneCount), blocked: Math.max(0, blockedCount) },
  };
}
