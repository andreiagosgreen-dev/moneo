import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_QUEUE,
  type Moment,
  confettiCount,
  detectWorkMoments,
  enqueueMoments,
  loadCelebratePrefs,
  markMomentShown,
  momentDuration,
  saveCelebratePrefs,
  sessionMoment,
} from './moments';
import type { Project } from './projects';
import type { Task } from './tasks';
import type { WaterfallPhase } from './waterfall';

const project = (id: string, extra: Partial<Project> = {}): Project => ({
  id,
  name: `Project ${id}`,
  color: '#000',
  category: 'work',
  tags: [],
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

const task = (id: string, projectId: string, status: Task['status'], extra: Partial<Task> = {}) =>
  ({
    id,
    projectId,
    title: `Task ${id}`,
    status,
    priority: 'medium',
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  }) as Task;

const phase = (
  id: string,
  projectId: string,
  status: WaterfallPhase['status'],
): WaterfallPhase => ({
  id,
  projectId,
  name: `Phase ${id}`,
  order: 0,
  status,
  createdAt: 0,
  updatedAt: 0,
});

const projects = [project('p1'), project('p2')];

describe('sessionMoment', () => {
  it('keys by completion time and rounds minutes', () => {
    const m = sessionMoment({ at: 1_700_000_000_000, min: 24.6 });
    expect(m).toMatchObject({ id: 'session:1700000000000', kind: 'session', minutes: 25 });
    expect(m.variant).toBeGreaterThanOrEqual(0);
    expect(m.variant).toBeLessThan(3);
  });

  it('is deterministic', () => {
    expect(sessionMoment({ at: 42_000, min: 5 })).toEqual(sessionMoment({ at: 42_000, min: 5 }));
  });
});

describe('detectWorkMoments', () => {
  it('returns nothing when nothing changed', () => {
    const tasks = [task('a', 'p1', 'pending')];
    const phases: WaterfallPhase[] = [];
    expect(detectWorkMoments({ tasks, phases }, { tasks, phases }, projects)).toEqual([]);
  });

  it('celebrates a project when its last open task is completed', () => {
    const prev = [task('a', 'p1', 'completed'), task('b', 'p1', 'pending')];
    const next = [task('a', 'p1', 'completed'), task('b', 'p1', 'completed')];
    const out = detectWorkMoments(
      { tasks: prev, phases: [] },
      { tasks: next, phases: [] },
      projects,
    );
    expect(out).toEqual([{ id: 'project:p1', kind: 'project', label: 'Project p1', variant: 0 }]);
  });

  it('does not celebrate a project finished by deleting the open task', () => {
    const prev = [task('a', 'p1', 'completed'), task('b', 'p1', 'pending')];
    const next = [task('a', 'p1', 'completed')];
    expect(
      detectWorkMoments({ tasks: prev, phases: [] }, { tasks: next, phases: [] }, projects),
    ).toEqual([]);
  });

  it('celebrates a completed milestone task while the project is still open', () => {
    const prev = [task('m', 'p1', 'in_progress', { milestone: true }), task('b', 'p1', 'pending')];
    const next = [task('m', 'p1', 'completed', { milestone: true }), task('b', 'p1', 'pending')];
    const out = detectWorkMoments(
      { tasks: prev, phases: [] },
      { tasks: next, phases: [] },
      projects,
    );
    expect(out.map((m) => m.id)).toEqual(['milestone:m']);
    expect(out[0].label).toBe('Task m');
  });

  it('ignores plain (non-milestone) task completions that leave the project open', () => {
    const prev = [task('a', 'p1', 'pending'), task('b', 'p1', 'pending')];
    const next = [task('a', 'p1', 'completed'), task('b', 'p1', 'pending')];
    expect(
      detectWorkMoments({ tasks: prev, phases: [] }, { tasks: next, phases: [] }, projects),
    ).toEqual([]);
  });

  it('celebrates a phase flipping to done', () => {
    const prev = [phase('x', 'p1', 'active'), phase('y', 'p1', 'todo')];
    const next = [phase('x', 'p1', 'done'), phase('y', 'p1', 'active')];
    const out = detectWorkMoments(
      { tasks: [], phases: prev },
      { tasks: [], phases: next },
      projects,
    );
    expect(out).toEqual([{ id: 'phase:x', kind: 'phase', label: 'Phase x', variant: 0 }]);
  });

  it('folds the last phase into a project moment', () => {
    const prev = [phase('x', 'p1', 'done'), phase('y', 'p1', 'active')];
    const next = [phase('x', 'p1', 'done'), phase('y', 'p1', 'done')];
    const out = detectWorkMoments(
      { tasks: [], phases: prev },
      { tasks: [], phases: next },
      projects,
    );
    expect(out.map((m) => m.id)).toEqual(['project:p1']);
  });

  it('never celebrates archived or unknown projects', () => {
    const archived = [project('p1', { archived: true })];
    const prev = [task('a', 'p1', 'pending'), task('z', 'ghost', 'pending')];
    const next = [task('a', 'p1', 'completed'), task('z', 'ghost', 'completed')];
    expect(
      detectWorkMoments({ tasks: prev, phases: [] }, { tasks: next, phases: [] }, archived),
    ).toEqual([]);
  });

  it('ignores tasks that arrive already completed', () => {
    const next = [task('new', 'p2', 'completed')];
    expect(
      detectWorkMoments({ tasks: [], phases: [] }, { tasks: next, phases: [] }, projects),
    ).toEqual([]);
  });
});

const m = (id: string, kind: Moment['kind']): Moment => ({ id, kind, variant: 0 });

describe('enqueueMoments', () => {
  it('appends in order and skips duplicates', () => {
    const q = enqueueMoments(
      [m('phase:a', 'phase')],
      [m('phase:a', 'phase'), m('project:b', 'project')],
      {},
    );
    expect(q.map((x) => x.id)).toEqual(['phase:a', 'project:b']);
  });

  it('skips non-session moments already shown, but never sessions', () => {
    const shown = { 'moment:project:b': true, 'moment:session:1': true } as Record<string, true>;
    const q = enqueueMoments([], [m('project:b', 'project'), m('session:1', 'session')], shown);
    expect(q.map((x) => x.id)).toEqual(['session:1']);
  });

  it('keeps only the newest waiting session moment', () => {
    const q = enqueueMoments(
      [m('phase:a', 'phase'), m('session:1', 'session')],
      [m('session:2', 'session')],
      {},
    );
    expect(q.map((x) => x.id)).toEqual(['phase:a', 'session:2']);
  });

  it('never drops the moment currently on screen', () => {
    const q = enqueueMoments([m('session:1', 'session')], [m('session:2', 'session')], {});
    expect(q.map((x) => x.id)).toEqual(['session:1', 'session:2']);
  });

  it('caps the queue, dropping the lightest waiting moment first', () => {
    const q = enqueueMoments(
      [m('session:0', 'session'), m('phase:a', 'phase'), m('session:1', 'session')],
      [m('project:p', 'project')],
      {},
    );
    expect(q).toHaveLength(MAX_QUEUE);
    expect(q.map((x) => x.id)).toEqual(['session:0', 'phase:a', 'project:p']);
  });
});

describe('markMomentShown', () => {
  it('logs non-session moments with a prefix and leaves sessions alone', () => {
    expect(markMomentShown({}, m('phase:a', 'phase'))).toEqual({ 'moment:phase:a': true });
    const shown = {};
    expect(markMomentShown(shown, m('session:1', 'session'))).toBe(shown);
  });
});

describe('timing + confetti', () => {
  it('bigger wins stay longer', () => {
    expect(momentDuration('project')).toBeGreaterThan(momentDuration('phase'));
    expect(momentDuration('phase')).toBeGreaterThan(momentDuration('session'));
    expect(momentDuration('session')).toBeGreaterThanOrEqual(4000);
  });

  it('scales confetti by weight and drops it under reduced motion', () => {
    expect(confettiCount('project', false)).toBeGreaterThan(confettiCount('session', false));
    expect(confettiCount('project', true)).toBe(0);
    expect(confettiCount('session', true)).toBe(0);
  });
});

describe('celebrate prefs', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to on', () => {
    expect(loadCelebratePrefs()).toEqual({ enabled: true });
  });

  it('round-trips and ignores garbage', () => {
    saveCelebratePrefs({ enabled: false });
    expect(loadCelebratePrefs()).toEqual({ enabled: false });
    localStorage.setItem('moneo:celebrate-prefs', JSON.stringify({ enabled: 'nope' }));
    expect(loadCelebratePrefs()).toEqual({ enabled: true });
  });
});
