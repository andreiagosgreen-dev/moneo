import { describe, it, expect } from 'vitest';
import {
  billableAmount,
  createProjectObject,
  cloneProject,
  deadlinesDue,
  formatBillable,
  loadDeadlineReminders,
  markDeadlineReminded,
  saveDeadlineReminders,
  updateProject,
  deleteProject,
  activeProjects,
  archivedProjects,
  parseTags,
  getProjectStats,
  FREE_PROJECTS_LIMIT,
  type Project,
} from './projects';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? 'p1',
    name: overrides.name ?? 'Client Alpha',
    color: overrides.color ?? '#22c55e',
    category: overrides.category ?? 'clients',
    tags: overrides.tags ?? [],
    createdAt: 1000,
    updatedAt: 1000,
    ...(overrides.deadline !== undefined ? { deadline: overrides.deadline } : {}),
    ...(overrides.archived !== undefined ? { archived: overrides.archived } : {}),
    ...(overrides.billable !== undefined ? { billable: overrides.billable } : {}),
    ...(overrides.hourlyRate !== undefined ? { hourlyRate: overrides.hourlyRate } : {}),
  };
}

describe('createProjectObject', () => {
  it('creates a project with trimmed name and empty tags', () => {
    const p = createProjectObject('  Website Revamp ', 'learning');
    expect(p.name).toBe('Website Revamp');
    expect(p.category).toBe('learning');
    expect(p.tags).toEqual([]);
    expect(p.archived).toBeUndefined();
  });
});

describe('cloneProject', () => {
  it("produces a new id with '(copy)' suffix and copied metadata", () => {
    const src = makeProject({ id: 'p1', tags: ['client'], deadline: 5000 });
    const copy = cloneProject(src);
    expect(copy.id).not.toBe('p1');
    expect(copy.name).toBe('Client Alpha (copy)');
    expect(copy.color).toBe(src.color);
    expect(copy.category).toBe(src.category);
    expect(copy.tags).toEqual(['client']);
    expect(copy.deadline).toBe(5000);
    expect(copy.archived).toBeUndefined();
  });
});

describe('updateProject', () => {
  it('updates mutable fields without touching id/createdAt', () => {
    const updated = updateProject([makeProject()], 'p1', {
      name: '  Renamed  ',
      color: '#000000',
      category: 'work',
      tags: parseTags('client, urgent'),
      deadline: 9000,
    })[0];
    expect(updated.name).toBe('Renamed');
    expect(updated.color).toBe('#000000');
    expect(updated.category).toBe('work');
    expect(updated.tags).toEqual(['client', 'urgent']);
    expect(updated.deadline).toBe(9000);
    expect(updated.id).toBe('p1');
    expect(updated.createdAt).toBe(1000);
    expect(updated.updatedAt).toBeGreaterThan(1000);
  });

  it('removes deadline when null is passed', () => {
    const updated = updateProject([makeProject({ deadline: 5000 })], 'p1', { deadline: null })[0];
    expect(updated.deadline).toBeUndefined();
  });

  it('cleans empty tags', () => {
    const updated = updateProject([makeProject({ tags: ['a'] })], 'p1', {
      tags: parseTags('  , , '),
    })[0];
    expect(updated.tags).toEqual([]);
  });

  it('sets and removes the project doc (Faza 20)', () => {
    const withDoc = updateProject([makeProject()], 'p1', { doc: '  Some context  ' })[0];
    expect(withDoc.doc).toBe('Some context');
    const removed = updateProject([withDoc], 'p1', { doc: null })[0];
    expect(removed.doc).toBeUndefined();
    const blank = updateProject([withDoc], 'p1', { doc: '   ' })[0];
    expect(blank.doc).toBeUndefined();
  });
});

describe('deleteProject / activeProjects / archivedProjects', () => {
  it('filters out the deleted project', () => {
    const left = deleteProject([makeProject({ id: 'p1' }), makeProject({ id: 'p2' })], 'p1');
    expect(left.map((p) => p.id)).toEqual(['p2']);
  });

  it('separates active from archived', () => {
    const projects = [
      makeProject({ id: 'a', archived: true, name: 'Old' }),
      makeProject({ id: 'b', name: 'Active B' }),
      makeProject({ id: 'c' }),
    ];
    expect(activeProjects(projects).map((p) => p.id)).toEqual(['b', 'c']);
    expect(archivedProjects(projects).map((p) => p.id)).toEqual(['a']);
  });
});

describe('parseTags', () => {
  it('splits on commas/spaces, trims, dedupes, caps at 8', () => {
    const tags = parseTags('client,  urgent client,   b2b,extra,foo,bar,baz,qux,ten,two');
    expect(tags).toHaveLength(8);
    expect(tags[0]).toBe('client');
    expect(tags[1]).toBe('urgent');
  });
});

describe('getProjectStats', () => {
  it('computes minutes, sessions and per-day breakdown', () => {
    const t1 = new Date(2026, 8, 15, 10, 0).getTime();
    const t2 = new Date(2026, 8, 15, 12, 0).getTime();
    const t3 = new Date(2026, 8, 14, 9, 0).getTime();
    const stats = getProjectStats('p1', [
      { projectId: 'p1', min: 25, at: t1 },
      { projectId: 'p1', min: 50, at: t2 },
      { projectId: 'p1', min: 10, at: t3 },
      { projectId: 'p2', min: 999, at: t3 },
    ]);
    expect(stats.minutes).toBe(85);
    expect(stats.sessions).toBe(3);
    expect(stats.perDay).toEqual([
      { day: '2026-9-14', min: 10 },
      { day: '2026-9-15', min: 75 },
    ]);
  });
});

describe('FREE_PROJECTS_LIMIT', () => {
  it('is 3 (Free tier gate)', () => {
    expect(FREE_PROJECTS_LIMIT).toBe(3);
  });
});

describe('billable time', () => {
  it('prices minutes only for rated billable projects', () => {
    const billable = makeProject({ billable: true, hourlyRate: 100 });
    expect(billableAmount(billable, 60)).toBe(100);
    expect(billableAmount(billable, 30)).toBe(50);
    expect(billableAmount(makeProject({ billable: true }), 60)).toBe(0);
    expect(billableAmount(makeProject({ hourlyRate: 100 }), 60)).toBe(0);
    expect(billableAmount(billable, 0)).toBe(0);
  });

  it('formats USD amounts', () => {
    expect(formatBillable(1500.5)).toBe('$1,500.50');
    expect(formatBillable(0)).toBe('$0.00');
  });

  it('updates and clones billing fields', () => {
    const updated = updateProject([makeProject()], 'p1', { billable: true, hourlyRate: 80 });
    expect(updated[0].billable).toBe(true);
    expect(updated[0].hourlyRate).toBe(80);
    const removed = updateProject(updated, 'p1', { billable: false, hourlyRate: null });
    expect(removed[0].billable).toBeUndefined();
    expect(removed[0].hourlyRate).toBeUndefined();
    const copy = cloneProject(updated[0]);
    expect(copy.billable).toBe(true);
    expect(copy.hourlyRate).toBe(80);
  });
});

describe('deadlinesDue', () => {
  const HOUR = 3600_000;
  const now = new Date(2026, 8, 16, 12, 0).getTime();

  it('returns active projects due within 48h, soonest first', () => {
    const projects = [
      makeProject({ id: 'far', deadline: now + 72 * HOUR }),
      makeProject({ id: 'soon', deadline: now + 5 * HOUR }),
      makeProject({ id: 'later', deadline: now + 30 * HOUR }),
      makeProject({ id: 'past', deadline: now - HOUR }),
      makeProject({ id: 'archived', deadline: now + HOUR, archived: true }),
      makeProject({ id: 'nodeadline' }),
    ];
    const due = deadlinesDue(projects, now);
    expect(due.map((d) => d.project.id)).toEqual(['soon', 'later']);
    expect(due[0].msLeft).toBe(5 * HOUR);
  });

  it('returns [] on junk input', () => {
    expect(deadlinesDue([], now)).toEqual([]);
    expect(deadlinesDue([makeProject({ deadline: now + 1000 })], Number.NaN)).toEqual([]);
  });
});

describe('deadline reminder stamps', () => {
  it('loads empty, stamps days, persists round-trip', () => {
    expect(loadDeadlineReminders()).toEqual({});
    const stamped = markDeadlineReminded({}, 'p1', '2026-9-16');
    expect(stamped).toEqual({ p1: '2026-9-16' });
    expect(saveDeadlineReminders(stamped)).toBe(true);
    expect(loadDeadlineReminders()).toEqual({ p1: '2026-9-16' });
  });
});
