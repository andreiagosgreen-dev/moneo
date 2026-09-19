import { describe, expect, it } from 'vitest';
import {
  assembleSession,
  createManualSession,
  newSessionId,
  replaceSessionById,
  sessionFromRemoteRow,
} from './sessions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('stable session ids', () => {
  it('generates a UUID-shaped id (or spec-shaped fallback)', () => {
    const id = newSessionId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(10);
    // In jsdom, crypto.randomUUID is available → true UUID.
    expect(UUID_RE.test(id)).toBe(true);
  });

  it('never repeats across calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newSessionId()));
    expect(ids.size).toBe(200);
  });
});

describe('assembleSession', () => {
  it('returns null when there is nothing to credit', () => {
    expect(assembleSession(null)).toBeNull();
  });

  it('stamps a stable id and preserves at/min', () => {
    const entry = assembleSession({ at: 5000, min: 25 });
    expect(entry).not.toBeNull();
    expect(entry!.at).toBe(5000);
    expect(entry!.min).toBe(25);
    expect(typeof entry!.id).toBe('string');
    expect(entry!.id!.length).toBeGreaterThan(0);
  });

  it('attaches only the round-captured metadata that exists', () => {
    const withAll = assembleSession(
      { at: 1, min: 25 },
      { intention: 'Write thesis', areaId: 'area:work', projectId: 'proj-1' },
    );
    expect(withAll).toEqual({
      id: withAll!.id,
      at: 1,
      min: 25,
      intention: 'Write thesis',
      areaId: 'area:work',
      projectId: 'proj-1',
    });

    const bare = assembleSession(
      { at: 2, min: 50 },
      { intention: null, areaId: null, projectId: null },
    );
    expect(bare!.intention).toBeUndefined();
    expect(bare!.areaId).toBeUndefined();
    expect(bare!.projectId).toBeUndefined();
  });
});

describe('sessionFromRemoteRow', () => {
  it('builds a Session omitting null intention/areaId', () => {
    const s = sessionFromRemoteRow({ id: 'x', at: 1, min: 9, intention: null, areaId: null });
    expect(s).toEqual({ id: 'x', at: 1, min: 9 });
    expect(s.intention).toBeUndefined();
    expect(s.areaId).toBeUndefined();
  });

  it('preserves present intention/areaId', () => {
    const s = sessionFromRemoteRow({ id: 'x', at: 1, min: 9, intention: 'A', areaId: 'u-1' });
    expect(s).toEqual({ id: 'x', at: 1, min: 9, intention: 'A', areaId: 'u-1' });
  });
});

describe('replaceSessionById', () => {
  const history = [
    { id: 'a', at: 1, min: 1 },
    { id: 'b', at: 2, min: 2 },
    { id: 'c', at: 3, min: 3 },
  ];

  it('replaces exactly the matching id, preserving length and others', () => {
    const next = replaceSessionById(history, { id: 'b', at: 9, min: 9 });
    expect(next).toHaveLength(3); // same length
    expect(next.map((s) => s.id)).toEqual(['a', 'b', 'c']); // exactly one "b"
    expect(next.find((s) => s.id === 'b')).toEqual({ id: 'b', at: 9, min: 9 });
    expect(next.find((s) => s.id === 'a')).toEqual({ id: 'a', at: 1, min: 1 }); // unchanged
    expect(next.find((s) => s.id === 'c')).toEqual({ id: 'c', at: 3, min: 3 }); // unchanged
  });

  it('leaves history semantically unchanged when the id is absent', () => {
    const next = replaceSessionById(history, { id: 'zzz', at: 9, min: 9 });
    expect(next.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(next.find((s) => s.id === 'zzz')).toBeUndefined();
  });

  it('does not mutate the input array', () => {
    const before = history.map((s) => ({ ...s }));
    replaceSessionById(history, { id: 'b', at: 9, min: 9 });
    expect(history).toEqual(before);
  });
});

describe('createManualSession', () => {
  it('builds a session from valid manual input', () => {
    const at = Date.now() - 3600_000;
    const s = createManualSession({
      minutes: 45,
      at,
      projectId: 'p1',
      intention: '  Client work  ',
    });
    expect(s).not.toBeNull();
    expect(s!.min).toBe(45);
    expect(s!.at).toBe(at);
    expect(s!.projectId).toBe('p1');
    expect(s!.intention).toBe('Client work');
    expect(typeof s!.id).toBe('string');
  });

  it('floors fractional minutes and rejects out-of-range values', () => {
    const at = Date.now() - 1000;
    expect(createManualSession({ minutes: 25.9, at })!.min).toBe(25);
    expect(createManualSession({ minutes: 0, at })).toBeNull();
    expect(createManualSession({ minutes: -5, at })).toBeNull();
    expect(createManualSession({ minutes: 481, at })).toBeNull();
    expect(createManualSession({ minutes: Number.NaN, at })).toBeNull();
  });

  it('rejects future or invalid dates', () => {
    expect(createManualSession({ minutes: 25, at: Date.now() + 3600_000 })).toBeNull();
    expect(createManualSession({ minutes: 25, at: Number.NaN })).toBeNull();
  });

  it('omits empty optional metadata', () => {
    const s = createManualSession({ minutes: 10, at: 1000, projectId: '', intention: '   ' });
    expect(s!.projectId).toBeUndefined();
    expect(s!.intention).toBeUndefined();
  });
});
