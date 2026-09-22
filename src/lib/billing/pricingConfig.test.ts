import { describe, expect, it } from 'vitest';

import {
  FREE_LIMITS,
  PRICING_PLANS_DISPLAY,
  PRO_PRICES,
  SYNC_NOTE_KEY,
  SYNC_SCOPE_KEY,
  canExportSessions,
  canPrintReport,
  getComparisonRows,
  getPlanDisplay,
} from './pricingConfig';
import { en } from '../i18n/locales/en';
import { FREE_PROJECTS_LIMIT } from '../projects';
import { FREE_GOALS_LIMIT } from '../goals';
import { FREE_OKRS_LIMIT } from '../okrs';
import { FREE_HABITS_LIMIT } from '../habits';
import { FREE_SKILLS_LIMIT } from '../skills';
import { IVY_MAX_TASKS, IVY_FREE_MAX_TASKS } from '../ivyLee';
import { CORE_INSIGHT_LIMIT } from '../insights';

describe('pricingConfig — single source of truth', () => {
  it('lists exactly free + pro-monthly + pro-yearly with distinct prices', () => {
    expect(PRICING_PLANS_DISPLAY.map((p) => p.id)).toEqual([
      'free',
      'pro-monthly',
      'pro-yearly',
    ]);
    const prices = PRICING_PLANS_DISPLAY.map((p) => p.price);
    expect(new Set(prices).size).toBe(3);
    expect(getPlanDisplay('pro-monthly')?.price).toBe('$5.99');
    expect(getPlanDisplay('pro-yearly')?.price).toBe('$59.99');
  });

  it('keeps yearly equivalent ≈ monthly×10 (2 months free vs 5.99×12)', () => {
    expect(PRO_PRICES.yearlyMonthly).toBe('$5.00');
    expect(PRO_PRICES.monthsFree).toBe(2);
  });

  it('keeps display limits in sync with the enforced domain constants', () => {
    expect(FREE_LIMITS.projects).toBe(FREE_PROJECTS_LIMIT);
    expect(FREE_LIMITS.goals).toBe(FREE_GOALS_LIMIT);
    expect(FREE_LIMITS.okrs).toBe(FREE_OKRS_LIMIT);
    expect(FREE_LIMITS.habits).toBe(FREE_HABITS_LIMIT);
    expect(FREE_LIMITS.skills).toBe(FREE_SKILLS_LIMIT);
    expect(FREE_LIMITS.ivyTasks).toBe(IVY_FREE_MAX_TASKS);
    expect(FREE_LIMITS.ivyMax).toBe(IVY_MAX_TASKS);
    expect(FREE_LIMITS.insights).toBe(CORE_INSIGHT_LIMIT);
  });

  it('exposes feature lists as i18n keys (no hardcoded display copy)', () => {
    for (const plan of PRICING_PLANS_DISPLAY) {
      expect(plan.featureKeys.length).toBeGreaterThan(0);
      for (const key of plan.featureKeys) {
        expect(key.startsWith('pay.')).toBe(true);
      }
    }
  });

  it('gates exports behind Pro', () => {
    expect(canExportSessions(false)).toBe(false);
    expect(canExportSessions(true)).toBe(true);
    expect(canPrintReport(false)).toBe(false);
    expect(canPrintReport(true)).toBe(true);
  });

  it('builds comparison rows from live limits (no hardcoded numbers)', () => {
    const rows = getComparisonRows();
    expect(rows.length).toBe(8);
    const projects = rows[0];
    expect(projects.labelKey).toBe('pay.plan.monthly.f1');
    expect(projects.free).toEqual({ kind: 'limit', value: FREE_PROJECTS_LIMIT });
    expect(projects.pro).toEqual({ kind: 'key', key: 'pricing.unlimited' });
    const ivy = rows[1];
    expect(ivy.free).toEqual({ kind: 'limit', value: IVY_FREE_MAX_TASKS });
    expect(ivy.pro).toEqual({ kind: 'limit', value: IVY_MAX_TASKS });
  });

  it('keeps sync marketing keys honest (sessions / areas / settings only)', () => {
    expect(SYNC_SCOPE_KEY).toBe('pay.syncScope');
    expect(SYNC_NOTE_KEY).toBe('pay.syncNote');
    const scope = en[SYNC_SCOPE_KEY].toLowerCase();
    expect(scope).toMatch(/session/);
    expect(scope).toMatch(/area/);
    expect(scope).toMatch(/setting/);
    expect(en[SYNC_NOTE_KEY].toLowerCase()).toMatch(/project/);
    expect(en['pay.plan.monthly.f5'].toLowerCase()).toMatch(/session/);
    expect(en['pay.plan.monthly.f5'].toLowerCase()).not.toMatch(/all data|everything/);
  });

  it('does not market free Focus atmospheres as Pro “premium themes”', () => {
    const look = en['pay.plan.monthly.f6'].toLowerCase();
    expect(look).toMatch(/light|accent|font/);
    expect(look).not.toMatch(/premium theme|atmosphere/);
  });
});
