import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanupLinksFor,
  createLink,
  linksFor,
  loadLinks,
  otherSide,
  removeLink,
  saveLinks,
  type EntityLink,
} from './entityLinks';

beforeEach(() => {
  localStorage.clear();
});

describe('loadLinks / saveLinks', () => {
  it('round-trips and defaults malformed data away', () => {
    expect(loadLinks()).toEqual([]);
    const links = createLink([], 'goal', 'g1', 'project', 'p1');
    expect(saveLinks(links)).toBe(true);
    expect(loadLinks()).toEqual(links);

    localStorage.setItem('moneo:links', JSON.stringify([{ id: 'x' }, 'garbage', null]));
    expect(loadLinks()).toEqual([]);
  });
});

describe('createLink', () => {
  it('creates a link with a stable id and timestamp', () => {
    const links = createLink([], 'goal', 'g1', 'project', 'p1');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ aType: 'goal', aId: 'g1', bType: 'project', bId: 'p1' });
    expect(typeof links[0].id).toBe('string');
    expect(links[0].id).not.toBe('');
  });

  it('rejects a self-link (same type and id)', () => {
    expect(createLink([], 'goal', 'g1', 'goal', 'g1')).toEqual([]);
  });

  it('dedupes A-B against an existing B-A', () => {
    let links = createLink([], 'goal', 'g1', 'project', 'p1');
    links = createLink(links, 'project', 'p1', 'goal', 'g1');
    expect(links).toHaveLength(1);
  });

  it('allows distinct edges between the same pair of types', () => {
    let links = createLink([], 'goal', 'g1', 'project', 'p1');
    links = createLink(links, 'goal', 'g2', 'project', 'p1');
    expect(links).toHaveLength(2);
  });
});

describe('removeLink', () => {
  it('removes by id and leaves others untouched', () => {
    let links = createLink([], 'goal', 'g1', 'project', 'p1');
    links = createLink(links, 'goal', 'g2', 'skill', 's1');
    const removed = removeLink(links, links[0].id);
    expect(removed).toHaveLength(1);
    expect(removed[0].aId).toBe('g2');
  });
});

describe('linksFor / otherSide', () => {
  it('finds links touching an entity in either direction', () => {
    let links = createLink([], 'goal', 'g1', 'project', 'p1');
    links = createLink(links, 'skill', 's1', 'goal', 'g1');
    expect(linksFor(links, 'goal', 'g1')).toHaveLength(2);
    expect(linksFor(links, 'project', 'p1')).toHaveLength(1);
    expect(linksFor(links, 'skill', 'nope')).toHaveLength(0);
  });

  it('resolves the other side relative to a known entity', () => {
    const link: EntityLink = createLink([], 'goal', 'g1', 'project', 'p1')[0];
    expect(otherSide(link, 'goal', 'g1')).toEqual({ type: 'project', id: 'p1' });
    expect(otherSide(link, 'project', 'p1')).toEqual({ type: 'goal', id: 'g1' });
  });
});

describe('cleanupLinksFor', () => {
  it('strips every link touching a deleted entity, keeps the rest', () => {
    let links = createLink([], 'goal', 'g1', 'project', 'p1');
    links = createLink(links, 'skill', 's1', 'project', 'p1');
    links = createLink(links, 'goal', 'g2', 'journal', '2026-9-21');
    const next = cleanupLinksFor(links, 'project', 'p1');
    expect(next).toHaveLength(1);
    expect(next[0].aId).toBe('g2');
  });
});

describe('objective as a linkable type (Faza 19)', () => {
  it('links, resolves, and cleans up an objective edge like any other type', () => {
    const links = createLink([], 'objective', 'o1', 'goal', 'g1');
    expect(links).toHaveLength(1);
    expect(linksFor(links, 'objective', 'o1')).toHaveLength(1);
    expect(otherSide(links[0], 'objective', 'o1')).toEqual({ type: 'goal', id: 'g1' });
    expect(cleanupLinksFor(links, 'objective', 'o1')).toHaveLength(0);
  });
});
