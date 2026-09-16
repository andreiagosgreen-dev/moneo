import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadBlocks,
  saveBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  blocksForWeekday,
  currentWeekKeys,
  weekdayOfKey,
  minuteOfDayInTz,
  adherenceForDay,
  BLOCK_PALETTE,
  type Weekday,
} from './timeBlocks';

const TZ = 'UTC';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('createBlock', () => {
  it('creates a valid block with defaults', () => {
    const b = createBlock({
      label: '  Deep work  ',
      weekday: 2,
      startMin: 9 * 60,
      endMin: 11 * 60,
    });
    expect(b).not.toBeNull();
    expect(b!.label).toBe('Deep work');
    expect(b!.color).toBe(BLOCK_PALETTE[0]);
    expect(b!.startMin).toBe(540);
    expect(b!.endMin).toBe(660);
  });

  it('rejects blank labels and inverted spans', () => {
    expect(createBlock({ label: '  ', weekday: 0, startMin: 60, endMin: 30 })).toBeNull();
    expect(createBlock({ label: 'ok', weekday: 0, startMin: 60, endMin: 30 })).toBeNull();
  });

  it('links an optional project', () => {
    const b = createBlock({
      label: 'Client work',
      weekday: 5,
      startMin: 0,
      endMin: 60,
      projectId: 'p1',
    });
    expect(b!.projectId).toBe('p1');
  });
});

describe('updateBlock / deleteBlock', () => {
  const base = createBlock({
    label: 'Focus',
    weekday: 1,
    startMin: 60,
    endMin: 120,
    color: '#fff',
  })!;

  it('updates fields and stamps updatedAt', () => {
    const updated = updateBlock([base], base.id, { label: 'Renamed', endMin: 150 })[0];
    expect(updated.label).toBe('Renamed');
    expect(updated.endMin).toBe(150);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(base.updatedAt);
  });

  it('ignores a patch that would invert the span', () => {
    const updated = updateBlock([base], base.id, { endMin: 10 })[0];
    expect(updated.endMin).toBe(120);
  });

  it('deletes by id', () => {
    const left = deleteBlock([base], base.id);
    expect(left).toEqual([]);
  });
});

describe('blocksForWeekday', () => {
  it('filters and sorts by start time', () => {
    const a = createBlock({ label: 'Late', weekday: 3, startMin: 600, endMin: 700 })!;
    const b = createBlock({ label: 'Early', weekday: 3, startMin: 120, endMin: 180 })!;
    const c = createBlock({ label: 'Other day', weekday: 4, startMin: 0, endMin: 60 })!;
    const sorted = blocksForWeekday([a, b, c], 3);
    expect(sorted.map((x) => x.label)).toEqual(['Early', 'Late']);
  });
});

describe('week helpers', () => {
  it('weekdayOfKey parses and matches Date.getDay', () => {
    expect(weekdayOfKey('2026-9-14')).toBe(1); // a Monday
    expect(weekdayOfKey('2026-9-20')).toBe(0); // a Sunday
  });

  it('minuteOfDayInTz returns minutes from midnight', () => {
    const ts = Date.UTC(2026, 8, 15, 10, 30, 0);
    expect(minuteOfDayInTz(ts, 'UTC')).toBe(10 * 60 + 30);
  });

  it('currentWeekKeys returns 7 Monday-first keys', () => {
    const keys = currentWeekKeys(TZ);
    expect(keys).toHaveLength(7);
    expect(weekdayOfKey(keys[0])).toBe(1);
    expect(weekdayOfKey(keys[6])).toBe(0);
    for (let i = 1; i < keys.length; i++) {
      const [y, m, d] = keys[i].split('-').map(Number);
      const [py, pm, pd] = keys[i - 1].split('-').map(Number);
      expect((new Date(y, m - 1, d).getTime() - new Date(py, pm - 1, pd).getTime()) / 8.64e7).toBe(
        1,
      );
    }
  });
});

describe('adherenceForDay', () => {
  const block = createBlock({
    label: 'Focus',
    weekday: 1, // Monday
    startMin: 9 * 60,
    endMin: 11 * 60, // 09:00-11:00
  })!;

  it('counts sessions inside the window and yields a percentage', () => {
    const dateKey = '2026-9-14'; // Monday
    const inside = Date.UTC(2026, 8, 14, 9, 30); // 09:30 UTC
    const outside = Date.UTC(2026, 8, 14, 12, 0); // 12:00 UTC
    const ad = adherenceForDay(
      [
        { at: inside, min: 25 },
        { at: outside, min: 60 },
      ],
      [block],
      dateKey,
      TZ,
    );
    expect(ad.plannedMin).toBe(120);
    expect(ad.actualMin).toBe(25);
    expect(ad.pct).toBe(Math.round((25 / 120) * 100));
  });

  it('returns zeros when the day has no blocks', () => {
    const ad = adherenceForDay(
      [{ at: Date.UTC(2026, 8, 14, 9, 30), min: 25 }],
      [block],
      '2026-9-15',
      TZ,
    );
    expect(ad).toEqual({ plannedMin: 0, actualMin: 0, pct: 0 });
  });

  it('matches by weekday regardless of year/day', () => {
    const tuesday = '2026-9-15'; // Tuesday — block is Monday
    const ad = adherenceForDay(
      [{ at: Date.UTC(2026, 8, 15, 9, 30), min: 25 }],
      [block],
      tuesday,
      TZ,
    );
    expect(ad.actualMin).toBe(0);
  });
});

describe('storage round trip', () => {
  it('persists blocks and restores them', () => {
    const b = createBlock({
      label: 'Manage',
      weekday: 4,
      startMin: 90,
      endMin: 150,
      color: '#3ddc97',
    })!;
    saveBlocks([b]);
    const loaded = loadBlocks();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      label: 'Manage',
      weekday: 4,
      startMin: 90,
      endMin: 150,
      color: '#3ddc97',
    });
  });

  it('drops invalid block entries', () => {
    saveBlocks([
      {
        id: 'x',
        label: 'bad',
        weekday: 9 as Weekday,
        startMin: 100,
        endMin: 50,
        color: '#fff',
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    expect(loadBlocks()).toEqual([]);
  });
});
