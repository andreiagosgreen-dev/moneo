import { describe, expect, it } from 'vitest';

import {
  blockingTasks,
  canComplete,
  canNest,
  completeTask,
  createSubtaskObject,
  descendantIds,
  reparentTask,
  rootTasks,
  setBlockedBy,
  setDueAt,
  setNotes,
  setRecurrence,
  setTaskPoints,
  criticalChain,
  taskPoints,
  subtasksOf,
  taskDepth,
  moveTask,
  removeTask,
  MAX_TASK_DEPTH,
  type Task,
} from './tasks';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 't1',
    projectId: overrides.projectId ?? 'p1',
    title: overrides.title ?? 'Task',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'p1',
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
    ...overrides,
  };
}

describe('subtasks (3-level hierarchy)', () => {
  it('caps nesting at MAX_TASK_DEPTH = 3', () => {
    expect(MAX_TASK_DEPTH).toBe(3);
  });

  it('creates subtasks under a parent in the same project', () => {
    const parent = makeTask({ id: 'p' });
    const child = createSubtaskObject([parent], 'p', 'Child task');
    expect(child).not.toBeNull();
    expect(child!.parentId).toBe('p');
    expect(child!.projectId).toBe('p1');
    expect(child!.status).toBe('pending');
  });

  it('refuses nesting past depth 3', () => {
    const tasks = [
      makeTask({ id: 'l1' }),
      makeTask({ id: 'l2', parentId: 'l1' }),
      makeTask({ id: 'l3', parentId: 'l2' }),
    ];
    expect(taskDepth(tasks, 'l1')).toBe(1);
    expect(taskDepth(tasks, 'l3')).toBe(3);
    expect(canNest(tasks, 'l3', 'p1')).toBe(false);
    expect(createSubtaskObject(tasks, 'l3', 'Too deep')).toBeNull();
  });

  it('lists roots and children in display order', () => {
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b', parentId: 'a' }),
      makeTask({ id: 'c', parentId: 'a', status: 'completed' }),
      makeTask({ id: 'd', projectId: 'p2' }),
    ];
    expect(rootTasks(tasks, 'p1').map((t) => t.id)).toEqual(['a']);
    expect(subtasksOf(tasks, 'a').map((t) => t.id)).toEqual(['b', 'c']);
    expect(descendantIds(tasks, 'a').sort()).toEqual(['b', 'c']);
  });

  it('reparents within depth/cycle rules', () => {
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b' }),
      makeTask({ id: 'c', parentId: 'a' }),
    ];
    const moved = reparentTask(tasks, 'c', 'b');
    expect(moved.find((t) => t.id === 'c')!.parentId).toBe('b');
    // cycle: a under its own descendant c
    expect(reparentTask(tasks, 'a', 'c')).toBe(tasks);
    // detach to root
    const detached = reparentTask(moved, 'c', null);
    expect(detached.find((t) => t.id === 'c')!.parentId).toBeUndefined();
  });

  it('cascades deletes through descendants and cleans blocker refs', () => {
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b', parentId: 'a' }),
      makeTask({ id: 'c', parentId: 'b' }),
      makeTask({ id: 'd', blockedBy: ['a'] }),
    ];
    const left = removeTask(tasks, 'a');
    expect(left.map((t) => t.id)).toEqual(['d']);
    expect(left[0].blockedBy).toBeUndefined();
  });

  it('moves whole subtrees and drops stale parent/blocker refs', () => {
    const tasks = [
      makeTask({ id: 'a', projectId: 'p1' }),
      makeTask({ id: 'b', projectId: 'p1', parentId: 'a' }),
      makeTask({ id: 'c', projectId: 'p1', blockedBy: ['b'] }),
    ];
    const moved = moveTask(tasks, 'a', 'p9');
    expect(moved.find((t) => t.id === 'a')!.projectId).toBe('p9');
    expect(moved.find((t) => t.id === 'b')!.projectId).toBe('p9');
    expect(moved.find((t) => t.id === 'b')!.parentId).toBe('a');
    expect(moved.find((t) => t.id === 'c')!.projectId).toBe('p1');
  });
});

describe('dependencies (blockers)', () => {
  it('blocks completion until blockers are done', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
    const linked = setBlockedBy(tasks, 'b', ['a']);
    expect(linked.find((t) => t.id === 'b')!.blockedBy).toEqual(['a']);
    expect(
      canComplete(
        linked.find((t) => t.id === 'b')!,
        linked,
      ).ok,
    ).toBe(false);
    const done = linked.map((t) => (t.id === 'a' ? { ...t, status: 'completed' as const } : t));
    expect(
      canComplete(
        done.find((t) => t.id === 'b')!,
        done,
      ).ok,
    ).toBe(true);
  });

  it('reports blocking titles for the UI', () => {
    const tasks = [makeTask({ id: 'a', title: 'API first' }), makeTask({ id: 'b' })];
    const linked = setBlockedBy(tasks, 'b', ['a']);
    const b = linked.find((t) => t.id === 'b')!;
    expect(blockingTasks(b, linked).map((t) => t.title)).toEqual(['API first']);
    expect(canComplete(b, linked).blockers).toEqual(['API first']);
  });

  it('rejects self-refs, cross-project refs and cycles', () => {
    const tasks = [
      makeTask({ id: 'a', projectId: 'p1' }),
      makeTask({ id: 'b', projectId: 'p1' }),
      makeTask({ id: 'x', projectId: 'p2' }),
    ];
    const self = setBlockedBy(tasks, 'a', ['a']);
    expect(self.find((t) => t.id === 'a')!.blockedBy).toBeUndefined();
    const cross = setBlockedBy(tasks, 'a', ['x']);
    expect(cross.find((t) => t.id === 'a')!.blockedBy).toBeUndefined();
    const ab = setBlockedBy(tasks, 'a', ['b']);
    // b blocked by a would close the loop a->b->a
    const ba = setBlockedBy(ab, 'b', ['a']);
    expect(ba.find((t) => t.id === 'b')!.blockedBy).toBeUndefined();
  });
});

describe('recurrence / due dates / notes', () => {
  it('spawns the next instance when completing a daily task', () => {
    const tasks = [makeTask({ id: 'a', recurrence: 'daily', dueAt: 1000 })];
    const { tasks: next, spawned } = completeTask(tasks, 'a', 5000);
    expect(next.find((t) => t.id === 'a')!.status).toBe('completed');
    expect(spawned).not.toBeNull();
    expect(spawned!.status).toBe('pending');
    expect(spawned!.projectId).toBe('p1');
    expect(spawned!.dueAt).toBe(5000 + 24 * 60 * 60 * 1000);
    expect(next).toHaveLength(2);
  });

  it('advances weekly recurrences by 7 days from the later date', () => {
    const now = 10_000;
    const tasks = [makeTask({ id: 'a', recurrence: 'weekly', dueAt: now + 1_000 })];
    const { spawned } = completeTask(tasks, 'a', now);
    expect(spawned!.dueAt).toBe(now + 1_000 + 7 * 24 * 60 * 60 * 1000);
  });

  it('refuses to complete a blocked task even via completeTask', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b', blockedBy: ['a'] })];
    const { tasks: next, spawned } = completeTask(tasks, 'b');
    expect(next.find((t) => t.id === 'b')!.status).toBe('pending');
    expect(spawned).toBeNull();
  });

  it('sets recurrence, due dates and notes (additive, removable)', () => {
    const tasks = [makeTask({ id: 'a' })];
    const rec = setRecurrence(tasks, 'a', 'weekly');
    expect(rec[0].recurrence).toBe('weekly');
    expect(setRecurrence(rec, 'a', 'none')[0].recurrence).toBeUndefined();
    const due = setDueAt(tasks, 'a', 12345);
    expect(due[0].dueAt).toBe(12345);
    expect(setDueAt(due, 'a', null)[0].dueAt).toBeUndefined();
    const noted = setNotes(tasks, 'a', '  Remember the edge case  ');
    expect(noted[0].notes).toBe('  Remember the edge case  '.trim());
    expect(setNotes(noted, 'a', '')[0].notes).toBeUndefined();
  });
});

describe('story points + critical chain', () => {
  it('sets and clears points, defaulting unpointed to 1', () => {
    const tasks = [makeTask({ id: 'a' })];
    expect(taskPoints(tasks[0])).toBe(1);
    const pointed = setTaskPoints(tasks, 'a', 5);
    expect(pointed[0].points).toBe(5);
    expect(taskPoints(pointed[0])).toBe(5);
    expect(setTaskPoints(pointed, 'a', null)[0].points).toBeUndefined();
  });

  it('finds the longest dependency chain, blockers first', () => {
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b', blockedBy: ['a'] }),
      makeTask({ id: 'c', blockedBy: ['b'] }),
      makeTask({ id: 'solo' }),
      makeTask({ id: 'done', blockedBy: ['c'], status: 'completed' }),
    ];
    expect(criticalChain(tasks, 'p1').map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignores other projects, missing refs and cycles', () => {
    const tasks = [
      makeTask({ id: 'a', projectId: 'p2' }),
      makeTask({ id: 'x', blockedBy: ['y'] }),
      makeTask({ id: 'y', blockedBy: ['x'] }),
    ];
    const chain = criticalChain(tasks, 'p1');
    expect(chain.map((t) => t.id).sort()).toEqual(['x', 'y']);
    expect(criticalChain([], 'p1')).toEqual([]);
  });
});
