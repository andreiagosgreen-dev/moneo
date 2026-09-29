/* Ready-made life systems: a project, its tasks (with repeat rules) and matching habits.
 * All text comes from i18n at creation time, so stored data is in the user's language. */
import type { TKey, Vars } from './i18n/types';
import { createProjectObject, localDayKey, type Project, type ProjectCategory } from './projects';
import { createTaskObject, type Task, type TaskPriority } from './tasks';
import { createHabitObject, FREE_HABITS_LIMIT, type Habit, type HabitFrequency } from './habits';
import { legacyFromRule, matches, nextOccurrence, type RepeatRule } from './recurrence';
import { noonPlusDays } from './dayKeys';

export type LifeTemplateId =
  'exam' | 'sport' | 'moving' | 'reading' | 'newHabit' | 'language' | 'jobSearch' | 'declutter';

export const FREE_LIFE_TEMPLATES: LifeTemplateId[] = ['exam', 'reading', 'newHabit'];

export interface LifeTemplateTask {
  key: string;
  estimateMin?: number;
  priority?: TaskPriority;
  dueInDays?: number;
  repeat?: RepeatRule;
}

export interface LifeTemplateHabit {
  key: string;
  frequency: HabitFrequency;
  targetPerWeek: number;
  icon?: string;
}

export interface LifeTemplate {
  id: LifeTemplateId;
  icon: string;
  category: ProjectCategory;
  color: string;
  tasks: LifeTemplateTask[];
  habits: LifeTemplateHabit[];
}

const WEEKDAYS: RepeatRule = { kind: 'weekdays' };

export const LIFE_TEMPLATES: readonly LifeTemplate[] = [
  {
    id: 'exam',
    icon: '🎓',
    category: 'learning',
    color: '#3b82f6',
    tasks: [
      { key: 'syllabus', dueInDays: 0, priority: 'p1' },
      { key: 'plan', dueInDays: 0 },
      { key: 'revise', repeat: WEEKDAYS, estimateMin: 50 },
      { key: 'mock', dueInDays: 14, priority: 'p1' },
      { key: 'rest', dueInDays: 20 },
    ],
    habits: [{ key: 'study', frequency: 'daily', targetPerWeek: 7, icon: '📚' }],
  },
  {
    id: 'sport',
    icon: '🏃',
    category: 'personal',
    color: '#22c55e',
    tasks: [
      { key: 'goal', dueInDays: 0 },
      { key: 'schedule', dueInDays: 0 },
      { key: 'gear', dueInDays: 2 },
    ],
    habits: [
      { key: 'workout', frequency: 'weekly', targetPerWeek: 3, icon: '🏋️' },
      { key: 'walk', frequency: 'daily', targetPerWeek: 7, icon: '🚶' },
    ],
  },
  {
    id: 'moving',
    icon: '📦',
    category: 'personal',
    color: '#f97316',
    tasks: [
      { key: 'budget', dueInDays: 0, priority: 'p1' },
      { key: 'declutter', dueInDays: 3 },
      { key: 'boxes', dueInDays: 5 },
      { key: 'utilities', dueInDays: 7, priority: 'p1' },
      { key: 'address', dueInDays: 14 },
      { key: 'clean', dueInDays: 21 },
    ],
    habits: [],
  },
  {
    id: 'reading',
    icon: '📚',
    category: 'personal',
    color: '#8b5cf6',
    tasks: [
      { key: 'list', dueInDays: 0 },
      { key: 'pick', dueInDays: 0 },
    ],
    habits: [{ key: 'read', frequency: 'daily', targetPerWeek: 7, icon: '📚' }],
  },
  {
    id: 'newHabit',
    icon: '🎯',
    category: 'personal',
    color: '#06b6d4',
    tasks: [
      { key: 'why', dueInDays: 0 },
      { key: 'cue', dueInDays: 0 },
      { key: 'review', dueInDays: 7 },
    ],
    habits: [{ key: 'newHabit', frequency: 'daily', targetPerWeek: 7, icon: '⭐' }],
  },
  {
    id: 'language',
    icon: '🌍',
    category: 'learning',
    color: '#eab308',
    tasks: [
      { key: 'level', dueInDays: 0 },
      { key: 'resources', dueInDays: 1 },
      { key: 'talk', repeat: { kind: 'weeks', every: 1, weekdays: [5] }, estimateMin: 30 },
    ],
    habits: [{ key: 'practice', frequency: 'daily', targetPerWeek: 7, icon: '💬' }],
  },
  {
    id: 'jobSearch',
    icon: '💼',
    category: 'work',
    color: '#ec4899',
    tasks: [
      { key: 'cv', dueInDays: 0, priority: 'p1' },
      { key: 'linkedin', dueInDays: 1 },
      { key: 'list', dueInDays: 2 },
      { key: 'apply', repeat: WEEKDAYS, estimateMin: 30 },
      { key: 'prep', dueInDays: 7 },
    ],
    habits: [{ key: 'network', frequency: 'weekly', targetPerWeek: 2, icon: '📞' }],
  },
  {
    id: 'declutter',
    icon: '🧹',
    category: 'personal',
    color: '#ef4444',
    tasks: [
      { key: 'room', dueInDays: 0 },
      { key: 'donate', dueInDays: 7 },
      { key: 'sell', dueInDays: 10 },
    ],
    habits: [{ key: 'tidy', frequency: 'daily', targetPerWeek: 7, icon: '🧹' }],
  },
];

export function getLifeTemplate(id: string): LifeTemplate | null {
  return LIFE_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function isTemplateAvailable(id: LifeTemplateId, isPro: boolean): boolean {
  return isPro || FREE_LIFE_TEMPLATES.includes(id);
}

export const tplKey = {
  name: (id: LifeTemplateId) => `goal.tpl.${id}.name` as TKey,
  desc: (id: LifeTemplateId) => `goal.tpl.${id}.desc` as TKey,
  task: (id: LifeTemplateId, key: string) => `goal.tpl.${id}.task.${key}` as TKey,
  habit: (id: LifeTemplateId, key: string) => `goal.tpl.${id}.habit.${key}` as TKey,
};

export interface LifeTemplateCtx {
  t: (k: TKey, v?: Vars) => string;
  now: number;
  isPro: boolean;
  existingActiveHabits: number;
}

/** First day on or after today that the rule hits (today counts). */
function firstRepeatKey(rule: RepeatRule, todayKey: string): string {
  return matches(rule, todayKey, todayKey) ? todayKey : nextOccurrence(rule, todayKey, todayKey);
}

function noonOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

/** Pure: builds the records; persistence stays with the caller. */
export function instantiateLifeTemplate(
  tpl: LifeTemplate,
  ctx: LifeTemplateCtx,
): { project: Project; tasks: Task[]; habits: Habit[]; skippedHabits: number } {
  const project = createProjectObject(ctx.t(tplKey.name(tpl.id)), tpl.category);
  project.color = tpl.color;
  const todayKey = localDayKey(ctx.now);

  const tasks = tpl.tasks.map((spec) => {
    const task: Task = {
      ...createTaskObject(project.id, ctx.t(tplKey.task(tpl.id, spec.key)), spec.priority ?? 'p2'),
    };
    if (typeof spec.estimateMin === 'number') task.estimateMin = spec.estimateMin;
    if (spec.repeat) {
      task.repeat = spec.repeat;
      task.recurrence = legacyFromRule(spec.repeat);
      task.dueAt = noonOf(firstRepeatKey(spec.repeat, todayKey));
    } else if (typeof spec.dueInDays === 'number') {
      task.dueAt = noonPlusDays(ctx.now, spec.dueInDays);
    }
    return task;
  });

  const room = ctx.isPro
    ? tpl.habits.length
    : Math.max(0, FREE_HABITS_LIMIT - ctx.existingActiveHabits);
  const habits = tpl.habits
    .slice(0, room)
    .map((h) =>
      createHabitObject(ctx.t(tplKey.habit(tpl.id, h.key)), h.frequency, h.targetPerWeek, h.icon),
    )
    .filter((h): h is Habit => h !== null);

  return { project, tasks, habits, skippedHabits: tpl.habits.length - habits.length };
}
