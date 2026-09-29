/**
 * Week planner data (Stage 3): seven Monday-first days with the day plan,
 * focus minutes, habit check-ins and tasks due. Pure; plan and sessions use
 * the account timezone, habit keys are device-local like the habit log.
 */
import type { IvyPlan } from './ivyLee';
import type { Task, TaskPriority } from './tasks';
import type { Session } from './store';
import { activeHabits, type Habit, type HabitLog } from './habits';
import { localDayKey } from './projects';
import { dayKeyInTz } from './timezone';
import { compareDayKeys, weekKeys } from './dayKeys';
import { dailyCheckinFor, type EnergyEntry } from './energy';

export interface WeekDueTask {
  id: string;
  title: string;
  done: boolean;
  priority: TaskPriority;
}

export interface WeekPlanItem {
  id: string;
  text: string;
  done: boolean;
}

export interface WeekDay {
  key: string;
  isToday: boolean;
  isFuture: boolean;
  plan: WeekPlanItem[];
  planDone: number;
  planTotal: number;
  pct: number;
  focusMin: number;
  habitsDone: number;
  habitsTotal: number;
  due: WeekDueTask[];
  /** Daily check-in (1–5), null when not logged. */
  energy: number | null;
  mood: number | null;
}

export interface WeekInput {
  mondayKey: string;
  todayKey: string;
  timezone: string;
  plans: IvyPlan[];
  tasks: Task[];
  history: Session[];
  habits: Habit[];
  habitLog: HabitLog;
  energyLog?: EnergyEntry[];
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };

export function buildWeek(input: WeekInput): WeekDay[] {
  const { mondayKey, todayKey, timezone } = input;
  const keys = weekKeys(mondayKey);
  const inWeek = new Set(keys);

  const focus = new Map<string, number>();
  for (const s of input.history) {
    if (!s || !Number.isFinite(s.at) || !Number.isFinite(s.min)) continue;
    const key = dayKeyInTz(s.at, timezone);
    if (inWeek.has(key)) focus.set(key, (focus.get(key) ?? 0) + s.min);
  }

  const due = new Map<string, WeekDueTask[]>();
  for (const task of input.tasks) {
    if (typeof task.dueAt !== 'number' || !Number.isFinite(task.dueAt)) continue;
    const key = dayKeyInTz(task.dueAt, timezone);
    if (!inWeek.has(key)) continue;
    const list = due.get(key) ?? [];
    list.push({
      id: task.id,
      title: task.title,
      done: task.status === 'completed',
      priority: task.priority,
    });
    due.set(key, list);
  }
  for (const list of due.values()) {
    list.sort(
      (a, b) =>
        Number(a.done) - Number(b.done) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
  }

  const plans = new Map(input.plans.map((p) => [p.dateKey, p]));
  const habits = activeHabits(input.habits);

  return keys.map((key) => {
    const plan = plans.get(key);
    const items = (plan?.tasks ?? []).map((x) => ({ id: x.id, text: x.text, done: x.done }));
    const planDone = items.filter((x) => x.done).length;
    const ticked = habits.filter((h) => (input.habitLog[h.id] ?? []).includes(key));
    const dailyDue = habits.filter(
      (h) => h.frequency === 'daily' && compareDayKeys(localDayKey(h.createdAt), key) <= 0,
    );
    // Weekly habits only count on the days they were ticked, so done ≤ total.
    const weeklyTicked = ticked.filter((h) => h.frequency === 'weekly').length;
    const checkin = dailyCheckinFor(input.energyLog ?? [], key);
    return {
      key,
      isToday: key === todayKey,
      isFuture: compareDayKeys(key, todayKey) > 0,
      plan: items,
      planDone,
      planTotal: items.length,
      pct: items.length > 0 ? Math.round((planDone / items.length) * 100) : 0,
      focusMin: Math.round(focus.get(key) ?? 0),
      habitsDone: ticked.length,
      habitsTotal: Math.max(ticked.length, dailyDue.length + weeklyTicked),
      due: due.get(key) ?? [],
      energy: checkin.energy,
      mood: checkin.mood,
    };
  });
}
