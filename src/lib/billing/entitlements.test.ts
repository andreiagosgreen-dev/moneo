import { describe, expect, it } from 'vitest';
import { currentPlanOf, getEntitlements } from './entitlements';
import { FREE_LIMITS } from './pricingConfig';
import { EXERCISES } from '../fitness/exercises';
import { MAX_CUSTOM } from '../fitness/custom';
import { FREE_AMBIENT } from '../ambient';
import { en } from '../i18n/locales/en';
import { ro } from '../i18n/locales/ro';

const all = () => getEntitlements().flatMap((a) => a.rows);
const row = (key: string) => all().find((r) => r.labelKey === key)!;

describe('plan entitlements', () => {
  it('covers every area of the app, Move included', () => {
    expect(getEntitlements().map((a) => a.id)).toEqual([
      'focus',
      'today',
      'projects',
      'plan',
      'move',
      'life',
      'reports',
      'account',
    ]);
  });

  it('uses the limits the code enforces', () => {
    expect(row('plan.ent.projects').free).toEqual({ kind: 'limit', value: FREE_LIMITS.projects });
    expect(row('plan.ent.habits').free).toEqual({ kind: 'limit', value: FREE_LIMITS.habits });
    expect(row('pricing.row.ivy').pro).toEqual({ kind: 'limit', value: FREE_LIMITS.ivyMax });
    expect(row('plan.ent.sounds').free).toEqual({ kind: 'limit', value: FREE_AMBIENT.length });
    expect(row('plan.ent.moveLibrary').labelVars).toEqual({ n: EXERCISES.length });
    expect(row('plan.ent.moveRoutines').labelVars).toEqual({ n: MAX_CUSTOM });
  });

  it('marks the Move Pro features as Pro only', () => {
    for (const key of ['plan.ent.moveRoutines', 'plan.ent.moveRecords', 'plan.ent.moveProgram']) {
      expect(row(key).free.kind).toBe('dash');
      expect(row(key).pro.kind).toBe('check');
    }
    expect(row('plan.ent.moveWorkouts').free.kind).toBe('check');
  });

  it('never gives Free something Pro lacks', () => {
    for (const r of all()) {
      if (r.free.kind === 'check') expect(r.pro.kind).not.toBe('dash');
    }
  });

  it('has a translation for every label and text value', () => {
    const keys = new Set<string>();
    for (const a of getEntitlements()) {
      keys.add(a.titleKey);
      for (const r of a.rows) {
        keys.add(r.labelKey);
        for (const v of [r.free, r.pro]) if (v.kind === 'key') keys.add(v.key);
      }
    }
    for (const k of keys) {
      expect((en as Record<string, string>)[k], k).toBeTruthy();
      expect((ro as Record<string, string>)[k], k).toBeTruthy();
    }
  });

  it('names the current plan, including gifted Pro', () => {
    const free = { planId: 'free' as const, isPro: false };
    expect(currentPlanOf(false, free)).toBe('free');
    expect(currentPlanOf(true, free)).toBe('pro-gift');
    expect(currentPlanOf(true, { planId: 'pro-yearly', isPro: true })).toBe('pro-yearly');
    expect(currentPlanOf(true, { planId: 'pro-monthly', isPro: true })).toBe('pro-monthly');
    // A lapsed paid row no longer grants Pro on its own.
    expect(currentPlanOf(false, { planId: 'pro-yearly', isPro: false })).toBe('free');
  });
});
