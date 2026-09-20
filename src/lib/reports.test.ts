import { describe, it, expect } from 'vitest';
import { rangeDayKeys, buildReport, paretoSplit, movingAverage, RANGES } from './reports';

const TZ = 'UTC';

interface SessionLike {
  at: number;
  min: number;
  projectId?: string;
  areaId?: string;
  taskId?: string;
}

function dayAt(daysAgo: number, hour = 12): number {
  const d = new Date(Date.now() - daysAgo * 24 * 3600_000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.getTime();
}

describe('RANGES', () => {
  it('offers week and month', () => {
    expect(RANGES.map((r) => r.key)).toEqual(['week', 'month']);
  });
});

describe('rangeDayKeys', () => {
  it('returns the trailing n days ending today, oldest first', () => {
    const keys = rangeDayKeys('week', TZ);
    expect(keys).toHaveLength(7);
    const today = new Date();
    expect(keys[6]).toBe(
      `${today.getUTCFullYear()}-${today.getUTCMonth() + 1}-${today.getUTCDate()}`,
    );
    // consecutive days
    for (let i = 1; i < keys.length; i++) {
      const [y, m, d] = keys[i].split('-').map(Number);
      const prev = new Date(y, m - 1, d);
      const [py, pm, pd] = keys[i - 1].split('-').map(Number);
      const before = new Date(py, pm - 1, pd);
      expect((prev.getTime() - before.getTime()) / 3600_000).toBe(24);
    }
  });

  it('returns 30 keys for month', () => {
    expect(rangeDayKeys('month', TZ)).toHaveLength(30);
  });
});

describe('buildReport', () => {
  const projects = [
    { id: 'p1', name: 'Website', color: '#22c55e' },
    { id: 'p2', name: 'Learning', color: '#6faeff' },
  ];
  const areas = [
    { id: 'a1', name: 'Backend' },
    { id: 'a2', name: 'Design' },
  ];
  const tasks = [{ id: 't1', title: 'Implement auth' }];

  function sessions(): SessionLike[] {
    return [
      { at: dayAt(0), min: 25, projectId: 'p1', areaId: 'a1', taskId: 't1' },
      { at: dayAt(0), min: 50, projectId: 'p2', areaId: 'a2' },
      { at: dayAt(1, 9), min: 10, projectId: 'p1', areaId: 'a1' },
      { at: dayAt(40), min: 999, projectId: 'p1', areaId: 'a1' }, // out of range
    ];
  }

  it('summarizes total, sessions and average per day', () => {
    const report = buildReport(sessions(), projects, areas, tasks, 'week', TZ);
    expect(report.summary.totalMin).toBe(85);
    expect(report.summary.sessionCount).toBe(3);
    expect(report.summary.avgMinPerDay).toBe(12);
  });

  it('fills every day bucket in the range', () => {
    const report = buildReport(sessions(), projects, areas, tasks, 'week', TZ);
    expect(report.days).toHaveLength(7);
    expect(report.days.reduce((s, d) => s + d.min, 0)).toBe(85);
  });

  it('breaks down minutes per project, sorted desc', () => {
    const report = buildReport(sessions(), projects, areas, tasks, 'week', TZ);
    expect(report.projects).toEqual([
      { projectId: 'p2', name: 'Learning', color: '#6faeff', min: 50 },
      { projectId: 'p1', name: 'Website', color: '#22c55e', min: 35 },
    ]);
  });

  it("groups unassigned sessions under 'Unassigned'", () => {
    const withUnassigned: SessionLike[] = [
      { at: dayAt(0), min: 7 },
      { at: dayAt(1), min: 8, projectId: 'p1' },
    ];
    const report = buildReport(withUnassigned, projects, areas, tasks, 'week', TZ);
    expect(report.projects.find((p) => p.projectId === '_unassigned')).toMatchObject({
      name: 'Unassigned',
      min: 7,
    });
  });

  it('breaks down minutes per area', () => {
    const report = buildReport(sessions(), projects, areas, tasks, 'week', TZ);
    expect(report.areas).toEqual([
      { areaId: 'a2', name: 'Design', min: 50 },
      { areaId: 'a1', name: 'Backend', min: 35 },
    ]);
  });

  it('aggregates minutes per task', () => {
    const report = buildReport(sessions(), projects, areas, tasks, 'week', TZ);
    expect(report.tasks).toEqual([{ taskId: 't1', title: 'Implement auth', min: 25 }]);
  });

  it('resolves deleted tasks to a fallback label', () => {
    const report = buildReport(
      sessions(),
      projects,
      areas,
      [{ id: 'gone', title: 'X' }],
      'week',
      TZ,
    );
    expect(report.tasks[0]).toMatchObject({ taskId: 't1', title: 'Deleted task' });
  });

  it('identifies the best day and top project', () => {
    const report = buildReport(sessions(), projects, areas, tasks, 'week', TZ);
    expect(report.summary.topDay?.min).toBe(75);
    expect(report.summary.topProject?.name).toBe('Learning');
  });

  it('excludes sessions older than the range', () => {
    const report = buildReport(sessions(), projects, areas, tasks, 'week', TZ);
    expect(report.summary.totalMin).toBe(85);
  });
});

describe('paretoSplit', () => {
  it('splits the head covering ~80% of minutes', () => {
    const slices = [
      { name: 'a', min: 70 },
      { name: 'b', min: 20 },
      { name: 'c', min: 10 },
    ];
    const { top, rest, topShare } = paretoSplit(slices);
    expect(top.map((s) => s.name)).toEqual(['a', 'b']);
    expect(rest.map((s) => s.name)).toEqual(['c']);
    expect(topShare).toBeCloseTo(0.9);
  });

  it('handles empty input', () => {
    expect(paretoSplit([])).toEqual({ top: [], rest: [], topShare: 0 });
    expect(paretoSplit([{ min: 0 }]).top).toEqual([]);
  });
});

describe('trend fields', () => {
  const projects = [{ id: 'p1', name: 'Website', color: '#22c55e' }];

  it('computes previousTotalMin for the immediately preceding period', () => {
    const sessions: SessionLike[] = [
      { at: dayAt(0), min: 30, projectId: 'p1' },
      { at: dayAt(10), min: 45, projectId: 'p1' }, // previous week
      { at: dayAt(40), min: 999, projectId: 'p1' }, // out of both windows
    ];
    const report = buildReport(sessions, projects, [], [], 'week', TZ);
    expect(report.summary.totalMin).toBe(30);
    expect(report.summary.previousTotalMin).toBe(45);
  });
});

describe('movingAverage', () => {
  it('averages trailing days, growing the window until full', () => {
    const days = [
      { key: '1', min: 10 },
      { key: '2', min: 20 },
      { key: '3', min: 30 },
      { key: '4', min: 40 },
    ];
    expect(movingAverage(days, 2)).toEqual([10, 15, 25, 35]);
  });

  it('returns an empty array for no days', () => {
    expect(movingAverage([], 3)).toEqual([]);
  });
});
