import { describe, expect, it } from 'vitest';

import {
  FREE_LIMITS,
  PRICING_PLANS_DISPLAY,
  PRO_PRICES,
  SYNC_NOTE_KEY,
  SYNC_SCOPE_KEY,
  canExportSessions,
  canPrintReport,
  canUseByokAi,
  getComparisonRows,
  getPlanDisplay,
} from './pricingConfig';
import { en } from '../i18n/locales/en';
import { de } from '../i18n/locales/de';
import { es } from '../i18n/locales/es';
import { fr } from '../i18n/locales/fr';
import { it as it_ } from '../i18n/locales/it';
import { ro } from '../i18n/locales/ro';
import { ru } from '../i18n/locales/ru';
import { uk } from '../i18n/locales/uk';
import { FREE_PROJECTS_LIMIT } from '../projects';
import { FREE_GOALS_LIMIT } from '../goals';
import { FREE_OKRS_LIMIT } from '../okrs';
import { FREE_HABITS_LIMIT } from '../habits';
import { FREE_SKILLS_LIMIT } from '../skills';
import { IVY_MAX_TASKS, IVY_FREE_MAX_TASKS } from '../ivyLee';
import { CORE_INSIGHT_LIMIT } from '../insights';
import { FREE_ROADMAPS_LIMIT, canAddRoadmap } from '../roadmapLimits';

describe('pricingConfig — single source of truth', () => {
  it('lists exactly free + pro-monthly + pro-yearly with distinct prices', () => {
    expect(PRICING_PLANS_DISPLAY.map((p) => p.id)).toEqual(['free', 'pro-monthly', 'pro-yearly']);
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
    expect(FREE_LIMITS.roadmaps).toBe(FREE_ROADMAPS_LIMIT);
  });

  it('exposes feature lists as i18n keys (no hardcoded display copy)', () => {
    for (const plan of PRICING_PLANS_DISPLAY) {
      expect(plan.featureKeys.length).toBeGreaterThan(0);
      for (const key of plan.featureKeys) {
        expect(key.startsWith('pay.')).toBe(true);
      }
    }
  });

  it('translates plan names in every locale via nameKey', () => {
    const locales: Array<Record<string, string>> = [de, es, fr, it_, ro, ru, uk];
    for (const plan of PRICING_PLANS_DISPLAY) {
      expect(en[plan.nameKey]).toBe(plan.name);
      for (const dict of locales) expect(dict[plan.nameKey]).toBeTruthy();
    }
    expect(locales.some((d) => d['pricing.plan.proMonthly.name'] !== 'Pro (Monthly)')).toBe(true);
  });

  it('gates exports and own-key AI behind Pro', () => {
    expect(canExportSessions(false)).toBe(false);
    expect(canExportSessions(true)).toBe(true);
    expect(canPrintReport(false)).toBe(false);
    expect(canPrintReport(true)).toBe(true);
    expect(canUseByokAi(false)).toBe(false);
    expect(canUseByokAi(true)).toBe(true);
    expect(canAddRoadmap(false, 0)).toBe(true);
    expect(canAddRoadmap(false, FREE_ROADMAPS_LIMIT)).toBe(false);
    expect(canAddRoadmap(true, 99)).toBe(true);
  });

  it('builds comparison rows from live limits (no hardcoded numbers)', () => {
    const rows = getComparisonRows();
    expect(rows.length).toBe(12);
    const projects = rows[0];
    expect(projects.labelKey).toBe('pay.plan.monthly.f1');
    expect(projects.free).toEqual({ kind: 'limit', value: FREE_PROJECTS_LIMIT });
    expect(projects.pro).toEqual({ kind: 'key', key: 'pricing.unlimited' });
    const ivy = rows[1];
    expect(ivy.free).toEqual({ kind: 'limit', value: IVY_FREE_MAX_TASKS });
    expect(ivy.pro).toEqual({ kind: 'limit', value: IVY_MAX_TASKS });
  });

  it('keeps the full JSON data export free and only advanced formats Pro', () => {
    const json = getComparisonRows().find((r) => r.labelKey === 'pricing.row.jsonExport');
    expect(json?.free).toEqual({ kind: 'check' });
    expect(en['rep.exportProTitle'].toLowerCase()).toMatch(/advanced/);
    for (const key of ['pay.sub', 'pricing.sub'] as const) {
      expect(en[key]).toMatch(/CSV\/PDF exports/);
    }
  });

  it('keeps sync marketing keys honest (free: sessions / areas / settings; Pro: all data)', () => {
    expect(SYNC_SCOPE_KEY).toBe('pay.syncScope');
    expect(SYNC_NOTE_KEY).toBe('pay.syncNote');
    const scope = en[SYNC_SCOPE_KEY].toLowerCase();
    expect(scope).toMatch(/session/);
    expect(scope).toMatch(/area/);
    expect(scope).toMatch(/setting/);
    expect(en[SYNC_NOTE_KEY].toLowerCase()).toMatch(/pro/);
    const f5 = en['pay.plan.monthly.f5'].toLowerCase();
    expect(f5).toMatch(/project/);
    expect(f5).toMatch(/session/);
    const row = getComparisonRows().find((r) => r.labelKey === 'pricing.row.sync');
    expect(row?.free).toEqual({ kind: 'key', key: 'pricing.sync.free' });
    expect(row?.pro).toEqual({ kind: 'key', key: 'pricing.sync.pro' });
    expect(en['pricing.sync.free'].toLowerCase()).toMatch(/session/);
    expect(en['pricing.sync.free'].toLowerCase()).not.toMatch(/all/);
  });

  it('markets AI honestly: your own key, never included, "full" or unlimited AI', () => {
    const keys = [
      'pay.plan.monthly.f2',
      'pay.sub',
      'pricing.sub',
      'land.faq.free.a',
      'pricing.feature.fullAi',
    ] as const;
    for (const key of keys) {
      const copy = en[key].toLowerCase();
      expect(copy).not.toMatch(/full ai|unlimited ai|included ai/);
      expect(copy).toMatch(/own (ai )?key/);
      expect(ro[key].toLowerCase()).not.toMatch(/ai inclus/);
    }
    const ai = getComparisonRows().find((r) => r.labelKey === 'pay.plan.monthly.f2');
    expect(ai?.free).toEqual({ kind: 'dash' });
    const insights = getComparisonRows().find((r) => r.labelKey === 'pricing.row.insights');
    expect(insights?.free).toEqual({ kind: 'limit', value: FREE_LIMITS.insights });
  });

  it('markets Pro look as light, accents, fonts and interior atmospheres', () => {
    const look = en['pay.plan.monthly.f6'].toLowerCase();
    expect(look).toMatch(/light|accent|font/);
    expect(look).toMatch(/interior|atmosphere/);
    expect(look).not.toMatch(/premium theme/);
  });
});
