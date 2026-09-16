import { describe, expect, it } from 'vitest';
import type { Session } from './store';
import { loadHistory } from './store';
import {
  AREA_NAME_MAX,
  MAX_AREAS,
  activeAreas,
  armRoundFocus,
  createFocusArea,
  deleteFocusArea,
  getWeeklyAreaSummary,
  loadFocusAreas,
  loadSelectedArea,
  markAreaDeleted,
  renameFocusArea,
  resolveAreaName,
  saveSelectedArea,
} from './focusAreas';
import { getTotalFocusedMinutes } from './growth';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
};

describe('default areas', () => {
  it('seeds Work / Study / Personal on first load and persists them', () => {
    const areas = loadFocusAreas();
    expect(areas.map((a) => a.name)).toEqual(['Work', 'Study', 'Personal']);
    expect(areas.every((a) => a.id.length > 0 && a.createdAt > 0)).toBe(true);
    expect(localStorage.getItem('moneo:focus-areas')).not.toBeNull();
  });

  it('does not re-seed when the user has deleted all areas', () => {
    localStorage.setItem('moneo:focus-areas', '[]');
    expect(loadFocusAreas()).toEqual([]);
  });
});

describe('area creation', () => {
  it('creates a custom area with a stable unique id', () => {
    const next = createFocusArea([], 'Thesis');
    expect(next).toHaveLength(1);
    expect(next![0].name).toBe('Thesis');
    const next2 = createFocusArea(next!, 'Client work');
    expect(next2![1].id).not.toBe(next![0].id);
  });

  it('trims the area name', () => {
    expect(createFocusArea([], '  Thesis  ')![0].name).toBe('Thesis');
  });

  it('rejects an empty name', () => {
    expect(createFocusArea([], '')).toBeNull();
  });

  it('rejects a whitespace-only name', () => {
    expect(createFocusArea([], '    ')).toBeNull();
  });

  it('accepts exactly the 40-character boundary', () => {
    const name = 'a'.repeat(AREA_NAME_MAX);
    expect(createFocusArea([], name)![0].name).toBe(name);
  });

  it('truncates names longer than 40 characters', () => {
    expect(createFocusArea([], 'a'.repeat(60))![0].name.length).toBe(AREA_NAME_MAX);
  });

  it('enforces the 8-area cap (a UX limit, not a paywall)', () => {
    let areas = createFocusArea([], 'A1')!;
    for (let i = 2; i <= MAX_AREAS; i++) {
      areas = createFocusArea(areas, `A${i}`)!;
    }
    expect(areas).toHaveLength(MAX_AREAS);
    expect(createFocusArea(areas, 'A9')).toBeNull();
    expect(areas).toHaveLength(MAX_AREAS);
  });
});

describe('rename and delete', () => {
  it('renames an area while keeping its id', () => {
    const areas = createFocusArea([], 'Work')!;
    const renamed = renameFocusArea(areas, areas[0].id, 'Job');
    expect(renamed![0].name).toBe('Job');
    expect(renamed![0].id).toBe(areas[0].id);
  });

  it('stamps updatedAt on rename for sync LWW', () => {
    const areas = createFocusArea([], 'Work')!;
    const renamed = renameFocusArea(areas, areas[0].id, 'Job', 4242)!;
    expect(renamed![0].updatedAt).toBe(4242);
  });

  it('rejects renaming to an empty name', () => {
    const areas = createFocusArea([], 'Work')!;
    expect(renameFocusArea(areas, areas[0].id, '   ')).toBeNull();
  });

  it('deletes only the targeted area', () => {
    let areas = createFocusArea([], 'Work')!;
    areas = createFocusArea(areas, 'Study')!;
    const after = deleteFocusArea(areas, areas[0].id);
    expect(after.map((a) => a.name)).toEqual(['Study']);
  });

  it('soft-deletes via markAreaDeleted, keeping the entry for sync', () => {
    const areas = createFocusArea([], 'Thesis')!;
    const marked = markAreaDeleted(areas, areas[0].id, 999);
    expect(marked).toHaveLength(1); // still present
    expect(marked[0].deletedAt).toBe(999);
    expect(marked[0].updatedAt).toBe(999);
    expect(activeAreas(marked)).toHaveLength(0); // hidden from UI
  });

  it('resolveAreaName returns null for soft-deleted areas', () => {
    const areas = createFocusArea([], 'Thesis')!;
    const marked = markAreaDeleted(areas, areas[0].id);
    expect(resolveAreaName(marked, areas[0].id)).toBeNull();
    expect(resolveAreaName(areas, areas[0].id)).toBe('Thesis');
  });
});

describe('storage robustness', () => {
  it('falls back to defaults on corrupt storage', () => {
    localStorage.setItem('moneo:focus-areas', '{corrupt');
    expect(loadFocusAreas().map((a) => a.name)).toEqual(['Work', 'Study', 'Personal']);
  });

  it('filters invalid stored entries while keeping valid siblings', () => {
    localStorage.setItem(
      'moneo:focus-areas',
      JSON.stringify([
        { id: '', name: 'NoId', createdAt: 1 },
        { id: 'x1', name: '   ', createdAt: 1 },
        { id: 'x2', name: 42, createdAt: 1 },
        { id: 'ok', name: 'Thesis', createdAt: 1 },
      ]),
    );
    const areas = loadFocusAreas();
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ id: 'ok', name: 'Thesis' });
  });
});

describe('round capture semantics', () => {
  const seeded = () => loadFocusAreas(); // Work / Study / Personal

  it('the current round captures its area immutably', () => {
    const areas = seeded();
    const thesis = areas[0];
    let selected: string | null = thesis.id;
    const captured = armRoundFocus('Write chapter 2', selected, areas);
    selected = areas[1].id; // user switches area mid-round
    expect(captured.areaId).toBe(thesis.id);
    expect(armRoundFocus('Write chapter 2', selected, areas).areaId).toBe(areas[1].id);
  });

  it('captures area and intention together', () => {
    const areas = seeded();
    const captured = armRoundFocus('Write chapter 2', areas[0].id, areas);
    expect(captured).toEqual({ intention: 'Write chapter 2', areaId: areas[0].id });
  });

  it('supports no area with an intention', () => {
    const captured = armRoundFocus('Deep work', null, seeded());
    expect(captured).toEqual({ intention: 'Deep work', areaId: null });
  });

  it('supports an area with no intention', () => {
    const areas = seeded();
    const captured = armRoundFocus('   ', areas[0].id, areas);
    expect(captured).toEqual({ intention: null, areaId: areas[0].id });
  });

  it('a deleted selected area falls back to no area', () => {
    let areas = seeded();
    const gone = areas[0].id;
    areas = deleteFocusArea(areas, gone);
    expect(armRoundFocus(null, gone, areas).areaId).toBeNull();
  });
});

describe('history compatibility', () => {
  const withArea: Session = { at: day(0), min: 25, intention: 'Ch. 2', areaId: 'ok' };

  it('new history with a valid areaId loads intact', () => {
    localStorage.setItem('solanum:history', JSON.stringify([withArea]));
    const loaded = loadHistory();
    expect(loaded).toEqual([withArea]);
  });

  it('an invalid areaId type drops the field, never the session', () => {
    localStorage.setItem(
      'solanum:history',
      JSON.stringify([{ at: 1000, min: 25, intention: 'X', areaId: 42 }]),
    );
    expect(loadHistory()).toEqual([{ at: 1000, min: 25, intention: 'X' }]);
  });

  it('deleting an area never deletes or rewrites historical sessions', () => {
    localStorage.setItem('solanum:history', JSON.stringify([withArea]));
    let areas = [{ id: 'ok', name: 'Thesis', createdAt: 1 }];
    areas = deleteFocusArea(areas, 'ok');
    const loaded = loadHistory();
    expect(loaded).toEqual([withArea]); // untouched
    expect(getTotalFocusedMinutes(loaded)).toBe(25);
    expect(resolveAreaName(areas, 'ok')).toBeNull();
  });

  it('soft-deleting an area leaves sessions and Growth intact', () => {
    localStorage.setItem('solanum:history', JSON.stringify([withArea]));
    const areas = [{ id: 'ok', name: 'Thesis', createdAt: 1 }];
    const marked = markAreaDeleted(areas, 'ok');
    expect(getTotalFocusedMinutes(loadHistory())).toBe(25);
    expect(resolveAreaName(marked, 'ok')).toBeNull();
  });
});

describe('weekly area summary', () => {
  const s = (min: number, areaId?: string, at = day(0)): Session =>
    areaId === undefined ? { at, min } : { at, min, areaId };

  it('aggregates minutes per area over the trailing 7 local days', () => {
    const rows = getWeeklyAreaSummary([
      s(25, 'thesis'),
      s(50, 'thesis', day(3)),
      s(30, 'work', day(2)),
      s(100, 'thesis', day(8)), // outside window
    ]);
    expect(rows).toEqual([
      { areaId: 'thesis', min: 75 },
      { areaId: 'work', min: 30 },
    ]);
  });

  it('excludes sessions without an area from the ranking', () => {
    const rows = getWeeklyAreaSummary([s(90), s(25, 'work')]);
    expect(rows).toEqual([{ areaId: 'work', min: 25 }]);
  });

  it('minutes survive area deletion (resolution is separate)', () => {
    const rows = getWeeklyAreaSummary([s(25, 'gone'), s(10, 'gone')]);
    expect(rows).toEqual([{ areaId: 'gone', min: 35 }]);
    expect(resolveAreaName([], 'gone')).toBeNull();
  });
});

describe('growth independence', () => {
  it('growth totals ignore areas entirely', () => {
    const history: Session[] = [
      { at: day(0), min: 25, areaId: 'a' },
      { at: day(0), min: 50 },
    ];
    expect(getTotalFocusedMinutes(history)).toBe(75);
  });
});

describe('selected area persistence', () => {
  it('validates the stored selection and falls back to null', () => {
    const areas = loadFocusAreas();
    expect(loadSelectedArea(areas)).toBeNull();
    saveSelectedArea(areas[0].id);
    expect(loadSelectedArea(areas)).toBe(areas[0].id);
    localStorage.setItem('moneo:selected-focus-area', '"deleted-id"');
    expect(loadSelectedArea(areas)).toBeNull();
    localStorage.setItem('moneo:selected-focus-area', '{{{');
    expect(loadSelectedArea(areas)).toBeNull();
  });
});
