import { describe, expect, it } from 'vitest';
import { assignProject, createInboxTask, inboxTasks, INBOX_PROJECT_ID, isInboxTask } from './inbox';
import { parseQuickAdd } from './quickAdd';
import { removeTask, type Task } from './tasks';

const NOW = new Date(2026, 8, 30, 10, 0).getTime();

function task(over: Partial<Task>): Task {
  return {
    id: 't',
    projectId: INBOX_PROJECT_ID,
    title: 'Idea',
    status: 'pending',
    priority: 'p2',
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

describe('inbox', () => {
  it('creates a task from a parsed phrase with date, time, priority and estimate', () => {
    const created = createInboxTask(parseQuickAdd('Gym tomorrow 7:00 !1 30 min', 'en', NOW));
    expect(created).toMatchObject({
      projectId: '',
      title: 'Gym',
      priority: 'p0',
      dueAt: new Date(2026, 9, 1, 7, 0).getTime(),
      dueHasTime: true,
      estimateMin: 30,
      status: 'pending',
    });
  });

  it('keeps the default priority and no time flag for a date-only phrase', () => {
    const created = createInboxTask(parseQuickAdd('Read friday', 'en', NOW));
    expect(created?.priority).toBe('p2');
    expect(created?.dueHasTime).toBeUndefined();
  });

  it('returns null when only tokens were typed', () => {
    expect(createInboxTask(parseQuickAdd('tomorrow 7:00', 'en', NOW))).toBeNull();
  });

  it('lists open root inbox tasks, oldest first', () => {
    const tasks = [
      task({ id: 'b', createdAt: 5 }),
      task({ id: 'a', createdAt: 2 }),
      task({ id: 'done', status: 'completed' }),
      task({ id: 'sub', parentId: 'a' }),
      task({ id: 'proj', projectId: 'p1' }),
    ];
    expect(inboxTasks(tasks).map((t) => t.id)).toEqual(['a', 'b']);
    expect(isInboxTask(tasks[2])).toBe(false);
    expect(isInboxTask(tasks[3])).toBe(false);
  });

  it('moves a task into a project and removes it', () => {
    const tasks = [task({ id: 'a' })];
    const moved = assignProject(tasks, 'a', 'p1');
    expect(moved[0].projectId).toBe('p1');
    expect(inboxTasks(moved)).toHaveLength(0);
    expect(removeTask(tasks, 'a')).toHaveLength(0);
  });
});
