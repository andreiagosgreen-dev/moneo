import { describe, expect, it } from 'vitest';
import { buildWeek, type WeekInput } from './weekView';
import type { Task } from './tasks';
import type { Habit } from './habits';

const noonUtc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 12);

function task(overrides: Partial<Task>): Task {
  return {
    id: 't',
    projectId: 'p',
    title: 'Task',
    status: 'pending',
    priority: 'p2',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function input(overrides: Partial<WeekInput> = {}): WeekInput {
  return {
    mondayKey: '2026-9-28',
    todayKey: '2026-9-30',
    timezone: 'UTC',
    plans: [],
    tasks: [],
    history: [],
    habits: [],
    habitLog: {},
    ...overrides,
  };
}

describe('buildWeek', () => {
  it('always returns seven Monday-first days with today and future flags', () => {
    const days = buildWeek(input());
    expect(days.map((d) => d.key)).toEqual([
      '2026-9-28',
      '2026-9-29',
      '2026-9-30',
      '2026-10-1',
      '2026-10-2',
      '2026-10-3',
      '2026-10-4',
    ]);
    expect(days.filter((d) => d.isToday).map((d) => d.key)).toEqual(['2026-9-30']);
    expect(days[3].isFuture).toBe(true);
    expect(days[1].isFuture).toBe(false);
  });

  it('reads the plan of each day', () => {
    const days = buildWeek(
      input({
        plans: [
          {
            dateKey: '2026-9-29',
            tasks: [
              { id: 'a', text: 'Write', done: true, rank: 1 },
              { id: 'b', text: 'Call', done: false, rank: 2 },
            ],
          },
        ],
      }),
    );
    expect(days[1]).toMatchObject({ planDone: 1, planTotal: 2, pct: 50 });
    expect(days[1].plan.map((x) => x.text)).toEqual(['Write', 'Call']);
    expect(days[0]).toMatchObject({ planTotal: 0, pct: 0 });
  });

  it('adds focus minutes on the day of the account timezone', () => {
    const lateEvening = Date.UTC(2026, 8, 29, 22, 30); // 01:30 on the 30th in Bucharest
    const days = buildWeek(
      input({ timezone: 'Europe/Bucharest', history: [{ at: lateEvening, min: 25 }] }),
    );
    expect(days[1].focusMin).toBe(0);
    expect(days[2].focusMin).toBe(25);
  });

  it('lists tasks due that day, open ones first then by priority', () => {
    const days = buildWeek(
      input({
        tasks: [
          task({ id: 'x', title: 'Normal', priority: 'p2', dueAt: noonUtc(2026, 10, 1) }),
          task({
            id: 'y',
            title: 'Urgent done',
            priority: 'p0',
            status: 'completed',
            dueAt: noonUtc(2026, 10, 1),
          }),
          task({ id: 'z', title: 'Important', priority: 'p1', dueAt: noonUtc(2026, 10, 1) }),
          task({ id: 'far', dueAt: noonUtc(2026, 10, 20) }),
        ],
      }),
    );
    expect(days[3].due.map((d) => d.id)).toEqual(['z', 'x', 'y']);
    expect(days[3].due[2].done).toBe(true);
    expect(days.flatMap((d) => d.due).some((d) => d.id === 'far')).toBe(false);
  });

  it('counts daily habits only from the day they were created', () => {
    const habit: Habit = {
      id: 'h1',
      name: 'Stretch',
      frequency: 'daily',
      targetPerWeek: 7,
      createdAt: new Date(2026, 8, 30, 9).getTime(),
      updatedAt: 1,
    };
    const weekly: Habit = { ...habit, id: 'h2', frequency: 'weekly', targetPerWeek: 1 };
    const days = buildWeek(
      input({ habits: [habit, weekly], habitLog: { h1: ['2026-9-30'], h2: ['2026-9-28'] } }),
    );
    expect(days[0]).toMatchObject({ habitsDone: 1, habitsTotal: 1 });
    expect(days[1]).toMatchObject({ habitsDone: 0, habitsTotal: 0 });
    expect(days[2]).toMatchObject({ habitsDone: 1, habitsTotal: 1 });
  });
});
