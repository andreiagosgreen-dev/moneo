import { describe, it, expect } from 'vitest';
import {
  createProjectObject,
  cloneProject,
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
