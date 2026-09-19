/**
 * Insight CTA execution (QA extraction).
 *
 * Pure state-in/state-out so every action is unit-testable. Rules:
 * - A tap is the approval — exactly one explicit action runs.
 * - Work is never lost: moves only complete when the target accepts
 *   (a full tomorrow keeps the task today, never drops it).
 * - Invalid payloads (bad windows, unknown ids, full lists) are no-ops.
 */

import { addTaskToDay, planForDay, removePlanTask, type IvyPlan } from './ivyLee';
import { createBlock, weekdayOfKey, type TimeBlock, type Weekday } from './timeBlocks';
import { nextDayKey } from './ritual';
import { setTaskPriority, type Task } from './tasks';
import type { InsightCta } from './insights';

export interface CtaState {
  plans: IvyPlan[];
  blocks: TimeBlock[];
  tasks: Task[];
}

export interface CtaCtx {
  todayKey: string;
  maxIvy: number;
  blockLabel: string;
}

const DAY_MIN = 1440;

export function executeInsightCta(state: CtaState, cta: InsightCta, ctx: CtaCtx): CtaState {
  switch (cta.type) {
    case 'none':
      return state;
    case 'block-tomorrow': {
      const endMin = cta.startMin + cta.minutes;
      if (cta.minutes <= 0 || cta.startMin < 0 || endMin > DAY_MIN) return state;
      const block = createBlock({
        label: ctx.blockLabel,
        weekday: weekdayOfKey(nextDayKey(ctx.todayKey)) as Weekday,
        startMin: cta.startMin,
        endMin,
      });
      if (!block) return state;
      return { ...state, blocks: [...state.blocks, block] };
    }
    case 'step-today':
    case 'add-to-plan': {
      const text = cta.type === 'step-today' ? cta.text : cta.title;
      const est = cta.type === 'add-to-plan' ? cta.estimateMin : undefined;
      const res = addTaskToDay(state.plans, ctx.todayKey, text, ctx.maxIvy, est);
      if (!res.added) return state;
      return { ...state, plans: res.plans };
    }
    case 'move-to-tomorrow': {
      const tomorrow = nextDayKey(ctx.todayKey);
      let acc = state.plans;
      let changed = false;
      for (const item of cta.tasks) {
        const inToday = planForDay(acc, ctx.todayKey)?.tasks.find((x) => x.id === item.id);
        if (!inToday) continue;
        const res = addTaskToDay(acc, tomorrow, item.text, ctx.maxIvy, item.estimateMin);
        if (!res.added) continue;
        acc = removePlanTask(res.plans, ctx.todayKey, item.id);
        changed = true;
      }
      return changed ? { ...state, plans: acc } : state;
    }
    case 'prioritize-task': {
      if (!state.tasks.some((t) => t.id === cta.taskId)) return state;
      return { ...state, tasks: setTaskPriority(state.tasks, cta.taskId, 'p0') };
    }
    default:
      return state;
  }
}
