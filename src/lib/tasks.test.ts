import { describe, it, expect } from 'vitest';
import {
  createTaskObject,
  tasksForProject,
  updateTaskStatus,
  renameTask,
  setTaskPriority,
  moveTask,
  removeTask,
  removeTasksForProject,
  getMinutesForTask,
  projectCompletion,
  setTaskEstimate,
  loadTasks,
  saveTasks,
  bulkSetStatus,
  bulkSetPriority,
  bulkSetDueAt,
  bulkMoveToProject,
  syncParentCompletion,
  createSubtaskObject,
  type Task,
} from './tasks';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 't1',
    projectId: overrides.projectId ?? 'p1',
    title: overrides.title ?? 'Implement auth',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'p1',
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
  };
}

describe('createTaskObject', () => {
  it('trims the title and defaults status to pending', () => {
    const t = createTaskObject('p1', '  Ship it  ');
    expect(t.title).toBe('Ship it');
    expect(t.status).toBe('pending');
    expect(t.projectId).toBe('p1');
  });
});

describe('tasksForProject', () => {
  it('returns only tasks for the project, sorted by status then priority', () => {
    const tasks: Task[] = [
      makeTask({ id: 'a', title: 'Done', status: 'completed', priority: 'p0' }),
      makeTask({ id: 'b', title: 'Boring', status: 'pending', priority: 'p3' }),
      makeTask({ id: 'c', title: 'Active', status: 'in_progress', priority: 'p2' }),
      makeTask({ id: 'd', title: 'Blocked', status: 'blocked', priority: 'p1' }),
      makeTask({ id: 'e', title: 'Other project', projectId: 'p2', status: 'pending' }),
    ];
    const ids = tasksForProject(tasks, 'p1').map((t) => t.id);
    // in_progress first, then pending, blocked, completed; p2 before p3 among pending
    expect(ids).toEqual(['c', 'b', 'd', 'a']);
  });
});

describe('updateTaskStatus', () => {
  it('stamps completedAt when completing', () => {
    const done = updateTaskStatus([makeTask({ id: 't1' })], 't1', 'completed');
    expect(done[0].status).toBe('completed');
    expect(typeof done[0].completedAt).toBe('number');
  });

  it('clears completedAt when reopening', () => {
    const reopened = updateTaskStatus(
      [
        makeTask({
          id: 't1',
          status: 'completed',
          completedAt: 5000,
        }),
      ],
      't1',
      'pending',
    );
    expect(reopened[0].status).toBe('pending');
    expect(reopened[0].completedAt).toBeUndefined();
  });
});

describe('renameTask / setTaskPriority / moveTask', () => {
  it('renames a task and trims empty titles away', () => {
    const renamed = renameTask([makeTask({ id: 't1' })], 't1', '  New name ');
    expect(renamed[0].title).toBe('New name');
    expect(renameTask([makeTask({ id: 't1' })], 't1', '   ')[0].title).toBe('Implement auth');
  });

  it('updates priority', () => {
    const bumped = setTaskPriority([makeTask({ id: 't1', priority: 'p3' })], 't1', 'p0');
    expect(bumped[0].priority).toBe('p0');
  });

  it('moves a task to another project', () => {
    const moved = moveTask([makeTask({ id: 't1' })], 't1', 'p9');
    expect(moved[0].projectId).toBe('p9');
  });
});

describe('removeTask / removeTasksForProject', () => {
  it('removes one task by id', () => {
    const left = removeTask([makeTask({ id: 't1' }), makeTask({ id: 't2' })], 't2');
    expect(left.map((t) => t.id)).toEqual(['t1']);
  });

  it('removes every task of a project', () => {
    const left = removeTasksForProject(
      [
        makeTask({ id: 't1', projectId: 'p1' }),
        makeTask({ id: 't2', projectId: 'p1' }),
        makeTask({ id: 't3', projectId: 'p7' }),
      ],
      'p1',
    );
    expect(left.map((t) => t.id)).toEqual(['t3']);
  });
});

describe('getMinutesForTask', () => {
  it('sums minutes for sessions tagged with the task', () => {
    const minutes = getMinutesForTask('t1', [
      { taskId: 't1', min: 25 },
      { taskId: 't1', min: 50 },
      { taskId: 't2', min: 10 },
      { min: 5 },
    ]);
    expect(minutes).toBe(75);
  });
});

describe('projectCompletion', () => {
  it('counts done vs total for a project', () => {
    const result = projectCompletion(
      [
        makeTask({ id: 'a', status: 'completed' }),
        makeTask({ id: 'b', status: 'pending' }),
        makeTask({ id: 'c', status: 'completed' }),
        makeTask({ id: 'd', projectId: 'p2' }),
      ],
      'p1',
    );
    expect(result).toEqual({ done: 2, total: 3 });
  });
});

describe('storage round-trip', () => {
  it('persists tasks that can be reloaded', () => {
    const tasks = [makeTask({ id: 't1', title: 'Round trip' })];
    saveTasks(tasks);
    const loaded = loadTasks();
    expect(loaded.find((t) => t.id === 't1')?.title).toBe('Round trip');
  });

  it('defaults invalid statuses and priorities', () => {
    saveTasks([
      {
        id: 't1',
        projectId: 'p1',
        title: 'x',
        status: 'weird' as never,
        priority: 'p9' as never,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    const loaded = loadTasks();
    expect(loaded[0].status).toBe('pending');
    expect(loaded[0].priority).toBe('p2');
  });
});

describe('setTaskEstimate', () => {
  it('sets, clamps and clears minute estimates', () => {
    const tasks = [makeTask({ id: 't1' })];
    expect(setTaskEstimate(tasks, 't1', 25)[0].estimateMin).toBe(25);
    expect(setTaskEstimate(tasks, 't1', 3)[0].estimateMin).toBe(5);
    expect(setTaskEstimate(tasks, 't1', 999)[0].estimateMin).toBe(480);
    expect(setTaskEstimate(tasks, 't1', null)[0].estimateMin).toBeUndefined();
    expect(setTaskEstimate(tasks, 'ghost', 25)).toEqual(tasks);
  });
});

describe('bulk actions (Faza 28)', () => {
  const tasks: Task[] = [
    makeTask({ id: 'a', projectId: 'p1', priority: 'p2', status: 'pending' }),
    makeTask({ id: 'b', projectId: 'p1', priority: 'p3', status: 'pending' }),
    makeTask({ id: 'c', projectId: 'p1', priority: 'p2', status: 'pending' }), // not selected
  ];

  it('bulkSetStatus/bulkSetPriority/bulkSetDueAt touch only the given ids', () => {
    const statused = bulkSetStatus(tasks, ['a', 'b'], 'in_progress');
    expect(statused.map((t) => t.status)).toEqual(['in_progress', 'in_progress', 'pending']);

    const prioritized = bulkSetPriority(tasks, ['a', 'b'], 'p0');
    expect(prioritized.map((t) => t.priority)).toEqual(['p0', 'p0', 'p2']);

    const due = bulkSetDueAt(tasks, ['a', 'b'], 5000);
    expect(due.map((t) => t.dueAt)).toEqual([5000, 5000, undefined]);
    expect(bulkSetDueAt(due, ['a'], null)[0].dueAt).toBeUndefined();
  });

  it('bulkMoveToProject moves each selected task (and subtree) to the target project', () => {
    const moved = bulkMoveToProject(tasks, ['a', 'b'], 'p2');
    expect(moved.map((t) => t.projectId)).toEqual(['p2', 'p2', 'p1']);
  });

  it('is a no-op for an empty id list', () => {
    expect(bulkSetPriority(tasks, [], 'p0')).toEqual(tasks);
  });
});

describe('syncParentCompletion (Faza 21)', () => {
  it('auto-completes a parent once every subtask is completed', () => {
    let tasks = [makeTask({ id: 'parent', projectId: 'p1' })];
    const c1 = createSubtaskObject(tasks, 'parent', 'Sub 1')!;
    const c2 = createSubtaskObject([...tasks, c1], 'parent', 'Sub 2')!;
    tasks = [...tasks, c1, c2];

    let next = updateTaskStatus(tasks, c1.id, 'completed');
    next = syncParentCompletion(next, c1.id);
    expect(next.find((t) => t.id === 'parent')!.status).not.toBe('completed');

    next = updateTaskStatus(next, c2.id, 'completed');
    next = syncParentCompletion(next, c2.id);
    expect(next.find((t) => t.id === 'parent')!.status).toBe('completed');
  });

  it('re-opens a completed parent when a subtask is reopened', () => {
    let tasks: Task[] = [
      makeTask({ id: 'parent', projectId: 'p1', status: 'completed' }),
      { ...makeTask({ id: 'child', projectId: 'p1', status: 'completed' }), parentId: 'parent' },
    ];
    tasks = updateTaskStatus(tasks, 'child', 'pending');
    tasks = syncParentCompletion(tasks, 'child');
    expect(tasks.find((t) => t.id === 'parent')!.status).toBe('pending');
  });

  it('is a no-op for a root task or a task whose parent has no subtasks left', () => {
    const tasks = [makeTask({ id: 'root', projectId: 'p1' })];
    expect(syncParentCompletion(tasks, 'root')).toEqual(tasks);
    expect(syncParentCompletion(tasks, 'ghost')).toEqual(tasks);
  });
});
