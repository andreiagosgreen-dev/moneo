import { describe, expect, it } from 'vitest';

import {
  balanceReport,
  burnoutGauge,
  loadLifeAreas,
  resetLifeAreas,
  saveLifeAreas,
  updateLifeArea,
} from './lifeAreas';

const NOW = new Date(2026, 8, 16, 12, 0).getTime();
const HOUR = 3600_000;

describe('lifeAreas', () => {
  it('seeds five default areas splitting 100%', () => {
    const areas = loadLifeAreas();
    expect(areas.map((a) => a.key)).toEqual([
      'health',
      'relationships',
      'learning',
      'work',
      'finance',
    ]);
    expect(areas.reduce((sum, a) => sum + a.targetPct, 0)).toBe(100);
  });

  it('updates targets/links with clamping', () => {
    const areas = loadLifeAreas();
    const work = areas.find((a) => a.key === 'work')!;
    const next = updateLifeArea(areas, work.id, { targetPct: 150, linkedAreaIds: ['a1', 'a2'] });
    const updated = next.find((a) => a.id === work.id)!;
    expect(updated.targetPct).toBe(100);
    expect(updated.linkedAreaIds).toEqual(['a1', 'a2']);
    expect(saveLifeAreas(next)).toBe(true);
    expect(loadLifeAreas().find((a) => a.id === work.id)!.targetPct).toBe(100);
  });

  it('resets to factory defaults', () => {
    expect(resetLifeAreas().map((a) => a.key)).toHaveLength(5);
  });

  it('scores perfect balance at 100 with no advice noise', () => {
    const areas = loadLifeAreas().map((a) => ({ ...a, linkedAreaIds: [`fa-${a.key}`] }));
    // 20 min in each of 5 areas = exact 20% split.
    const history = areas.flatMap((a, i) => [
      { areaId: `fa-${a.key}`, min: 20, at: NOW - (i + 1) * HOUR },
    ]);
    const report = balanceReport(areas, history, NOW, 7);
    expect(report.totalMin).toBe(100);
    expect(report.unassignedMin).toBe(0);
    expect(report.score).toBe(100);
    expect(report.neglected).toBeNull();
    expect(report.overtime).toBe(false);
  });

  it('flags neglected areas and work overtime', () => {
    const areas = loadLifeAreas().map((a) => ({ ...a, linkedAreaIds: [`fa-${a.key}`] }));
    // All 100 min into work (target 20, actual 100).
    const history = [{ areaId: 'fa-work', min: 100, at: NOW - HOUR }];
    const report = balanceReport(areas, history, NOW, 7);
    expect(report.overtime).toBe(true);
    expect(report.neglected).not.toBeNull();
    expect(report.score).toBeLessThan(100);
    expect(report.advice).toContain('Work is crowding out');
  });

  it('handles empty history gracefully', () => {
    const report = balanceReport(loadLifeAreas(), [], NOW, 7);
    expect(report.totalMin).toBe(0);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.advice).toContain('No focus time');
  });

  it('grades burnout from combined signals', () => {
    expect(burnoutGauge({ overtime: false, mood: 4, energy: 7, frogSkipRate: 0 }).level).toBe(
      'low',
    );
    const guarded = burnoutGauge({ overtime: true, mood: null, energy: null, frogSkipRate: null });
    expect(guarded.level).toBe('guarded');
    expect(guarded.reasons).toContain('Work overshoots its share');
    const high = burnoutGauge({ overtime: true, mood: 2, energy: 3, frogSkipRate: 0.8 });
    expect(high.level).toBe('high');
    expect(high.reasons).toHaveLength(4);
  });
});
