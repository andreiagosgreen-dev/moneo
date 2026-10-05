import { describe, expect, it } from 'vitest';
import { getExercise } from './library';
import {
  PACK_FORMATS,
  PACK_MINUTES,
  PACK_ZONES,
  buildPack,
  cleanGear,
  isPackId,
  packSeconds,
  packZoneOf,
  weightPicks,
} from './packs';
import { sanitizeWorkoutStore } from './workouts';
import { routineTitle } from './custom';
import { logSet, startRun, timedSet } from './player';

describe('buildPack', () => {
  it('builds every zone, length and format at home with no equipment', () => {
    for (const zone of PACK_ZONES) {
      for (const minutes of PACK_MINUTES) {
        for (const format of PACK_FORMATS) {
          const p = buildPack({ zone, minutes, format, level: 1 }, 'home', [], 7);
          expect(p, `${zone}/${minutes}/${format}`).not.toBeNull();
          for (const s of p!.steps) {
            const e = getExercise(s.ex)!;
            expect(['none', 'mat', 'chair']).toContain(e.equipment);
            expect(e.places).toContain('home');
          }
        }
      }
    }
  });

  it('lands near the chosen length', () => {
    for (const minutes of PACK_MINUTES) {
      for (const zone of ['full', 'core', 'lower'] as const) {
        const p = buildPack({ zone, minutes, format: 'circuit', level: 2 }, 'home', [], 3)!;
        const min = packSeconds(p.steps) / 60;
        expect(min).toBeGreaterThan(minutes * 0.6);
        expect(min).toBeLessThan(minutes * 1.3);
      }
    }
  });

  it('is repeatable for a seed and reshuffles with another', () => {
    const c = { zone: 'full' as const, minutes: 20, format: 'circuit' as const, level: 2 as const };
    expect(buildPack(c, 'home', [], 42)).toEqual(buildPack(c, 'home', [], 42));
    const variants = new Set(
      [1, 2, 3, 4, 5, 6].map((s) => buildPack(c, 'home', [], s)!.main.join()),
    );
    expect(variants.size).toBeGreaterThan(1);
  });

  it('uses the equipment the user owns', () => {
    const p = buildPack(
      { zone: 'core', minutes: 20, format: 'sets', level: 2 },
      'home',
      ['abWheel', 'abBench'],
      9,
    )!;
    const gear = p.main.map((id) => getExercise(id)!.equipment);
    expect(gear.some((g) => g === 'abWheel' || g === 'abBench')).toBe(true);
  });

  it('keeps beginners on beginner exercises', () => {
    const p = buildPack({ zone: 'upper', minutes: 30, format: 'sets', level: 1 }, 'gym', [], 5)!;
    for (const id of p.main) expect(getExercise(id)!.level).toBe(1);
  });

  it('times every circuit and tabata station', () => {
    for (const format of ['circuit', 'tabata'] as const) {
      const p = buildPack({ zone: 'full', minutes: 20, format, level: 2 }, 'home', [], 11)!;
      for (const s of p.steps) expect(typeof s.sec).toBe('number');
    }
    const t = buildPack({ zone: 'core', minutes: 20, format: 'tabata', level: 2 }, 'home', [], 1)!;
    expect(t.workSec).toBe(20);
    expect(t.restSec).toBe(10);
  });

  it('has a warm-up and a cool-down except for a stretch session', () => {
    const p = buildPack(
      { zone: 'lower', minutes: 30, format: 'circuit', level: 1 },
      'home',
      [],
      2,
    )!;
    expect(p.warmup.length).toBeGreaterThan(0);
    expect(p.cooldown.length).toBeGreaterThan(0);
    const m = buildPack(
      { zone: 'mobility', minutes: 20, format: 'sets', level: 1 },
      'home',
      [],
      2,
    )!;
    expect(m.warmup).toEqual([]);
  });
});

describe('gear profile', () => {
  it('keeps only known home gear and sane weights, sorted', () => {
    expect(
      cleanGear({
        items: ['abWheel', 'abWheel', 'laser', 'machine'],
        weights: [5, 0.5, -1, 'x', 5],
      }),
    ).toEqual({ items: ['abWheel'], weights: [0.5, 5] });
  });

  it('survives the store round trip', () => {
    const store = sanitizeWorkoutStore({
      log: [],
      gear: {
        items: ['dumbbell'],
        weights: [2, 10],
        last: { zone: 'core', minutes: 10, format: 'tabata', level: 3 },
      },
    });
    expect(store.gear?.items).toEqual(['dumbbell']);
    expect(store.gear?.last?.zone).toBe('core');
    expect(weightPicks(store.gear, 'bicepsCurl')).toEqual([2, 10]);
    expect(weightPicks(store.gear, 'pushup')).toEqual([]);
  });
});

describe('pack runs', () => {
  it('titles a pack from its id', () => {
    const t = (k: string, v?: Record<string, string | number>) =>
      k === 'fit.pack.title' ? `${v?.zone} · ${v?.min} min` : k;
    expect(isPackId('pack-core-20-circuit')).toBe(true);
    expect(packZoneOf('pack-core-20-circuit')).toBe('core');
    expect(routineTitle(t as never, { log: [] }, 'pack-core-20-circuit')).toBe(
      'fit.pack.zone.core · 20 min',
    );
  });

  it('logs typed reps on a timed station of a reps exercise', () => {
    const p = buildPack(
      { zone: 'upper', minutes: 10, format: 'circuit', level: 1 },
      'home',
      [],
      4,
    )!;
    const idx = p.steps.findIndex((s) => getExercise(s.ex)?.mode === 'reps');
    const steps = p.steps.slice(idx);
    let run = startRun(p.id, 0, [], steps)!;
    run = { ...run, reps: '12', timer: { leftMs: 0, endsAt: 1000 } };
    const set = timedSet(run, 1000)!;
    expect(set.reps).toBe(12);
    expect(logSet(run, set, 1000, []).sets[0].reps).toBe(12);
  });
});
