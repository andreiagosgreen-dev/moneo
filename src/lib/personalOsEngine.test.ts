import { describe, expect, it } from 'vitest';
import {
  compute5AxisRadar,
  computeAtomicMetrics,
  computeFitbodMuscleCurve,
  computeMacroFactorBudget,
  computeMindBodySynergy,
  computeMuscleRecovery48h,
  cycleIngredientSwap,
  loadFuelState,
  mealsForGoal,
  toggleMealEaten,
} from './personalOsEngine';

describe('personalOsEngine (Ideas #1–#10)', () => {
  it('returns 3 daily meals (morning, lunch, dinner) for every nutrition goal', () => {
    for (const g of ['cut', 'bulk', 'energy', 'balance'] as const) {
      const meals = mealsForGoal(g);
      expect(meals.map((m) => m.slot)).toEqual(['morning', 'lunch', 'dinner']);
      for (const m of meals) {
        expect(m.ingredients.length).toBeGreaterThanOrEqual(3);
        expect(m.kcal).toBeGreaterThan(200);
      }
    }
  });

  it('cycles ingredient analog swaps 0 → 1 → 2 → 3 → 0 and toggles eaten slots', () => {
    let state = loadFuelState();
    state = cycleIngredientSwap(state, 'm-cut', 'prot');
    expect(state.swaps['m-cut:prot']).toBe(1);
    state = cycleIngredientSwap(state, 'm-cut', 'prot');
    expect(state.swaps['m-cut:prot']).toBe(2);
    state = cycleIngredientSwap(state, 'm-cut', 'prot');
    expect(state.swaps['m-cut:prot']).toBe(3);
    state = cycleIngredientSwap(state, 'm-cut', 'prot');
    expect(state.swaps['m-cut:prot']).toBe(0);

    state = toggleMealEaten(state, '2026-11-22', 'morning');
    expect(state.eaten['2026-11-22:morning']).toBe(true);
  });

  it('computes Atomic Habits identity votes and 1% compound multiplier', () => {
    const now = Date.now();
    const res = computeAtomicMetrics({
      history: [{ id: 's1', at: now - 1000, min: 25 }],
      workouts: [],
      habitsDoneToday: 2,
      mealsEatenToday: 2,
      twoMinDoneToday: true,
      now,
    });
    expect(res.identityVotes).toBe(6);
    expect(res.compoundMultiplier).toBeGreaterThan(1);
    expect(res.neverMissTwiceAlert).toBe(false);
  });

  it('identifies fresh muscles for 48h recovery recommendations and 5-axis radar', () => {
    const rec = computeMuscleRecovery48h({ chest: 3, shoulders: 2 });
    expect(rec.hot).toContain('chest');
    expect(rec.recovering).toContain('shoulders');
    expect(rec.fresh).toContain('lats');
    expect(rec.recommendedPair[0]).toBe('lats');

    const radar = compute5AxisRadar({
      mindPct: 80,
      execPct: 75,
      bodyPct: 90,
      fuelPct: 66,
      habitPct: 100,
    });
    expect(radar.current).toEqual([80, 75, 90, 66, 100]);
    expect(radar.baseline[0]).toBeLessThan(radar.current[0]);
    // Honest zero-state: fresh accounts never fabricate synergy or radar floors.
    expect(computeMindBodySynergy([], [])).toBeNull();
    const emptyRadar = compute5AxisRadar({
      mindPct: 0,
      execPct: 0,
      bodyPct: 0,
      fuelPct: 0,
      habitPct: 0,
    });
    expect(emptyRadar.current).toEqual([0, 0, 0, 0, 0]);
    const emptyAtomic = computeAtomicMetrics({
      history: [],
      workouts: [],
      habitsDoneToday: 0,
      mealsEatenToday: 0,
      twoMinDoneToday: false,
    });
    expect(emptyAtomic.compoundMultiplier).toBe(1);
    expect(emptyAtomic.consistency28Pct).toBe(0);
  });

  it('computes Fitbod 0-100% exponential muscle recovery curve and MacroFactor adaptive budget', () => {
    const now = Date.now();
    const curve = computeFitbodMuscleCurve(
      [
        {
          id: 'w1',
          routineId: 'push',
          day: '2026-11-22',
          startedAt: now - 3 * 3600_000,
          durationSec: 1800,
          sets: [
            { ex: 'pushup', reps: 15 },
            { ex: 'pushup', reps: 15 },
            { ex: 'pushup', reps: 15 },
          ],
        },
      ],
      now,
    );
    expect(curve.chest.pct).toBeLessThan(85);
    expect(curve.lats.pct).toBe(100);

    const budget = computeMacroFactorBudget({
      goal: 'cut',
      focusMinToday: 60,
      workouts: [
        {
          id: 'w1',
          routineId: 'push',
          day: '2026-11-22',
          startedAt: now - 3600_000,
          durationSec: 1800,
          sets: [],
        },
      ],
      now,
    });
    expect(budget.trainedToday).toBe(true);
    expect(budget.deepFocusToday).toBe(true);
    expect(budget.targetProteinG).toBeGreaterThan(130);
    expect(budget.targetKcal).toBeGreaterThan(budget.baseKcal);
  });
});
