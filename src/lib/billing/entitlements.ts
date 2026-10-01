/**
 * What each plan gets, grouped by area — shown in Settings → Plan.
 *
 * Every number comes from the constant the code enforces (FREE_LIMITS, the
 * fitness library, ambient lists), so this list cannot promise something the
 * gates do not do. Pro monthly and Pro yearly unlock exactly the same features;
 * yearly only changes the price (see PRO_PRICES).
 */

import type { TKey, Vars } from '../i18n/types';
import { FREE_LIMITS, type ComparisonValue } from './pricingConfig';
import { AMBIENT_IDS, FREE_AMBIENT } from '../ambient';
import { EXERCISES } from '../fitness/exercises';
import { MAX_CUSTOM } from '../fitness/custom';

export interface EntitlementRow {
  labelKey: TKey;
  labelVars?: Vars;
  free: ComparisonValue;
  pro: ComparisonValue;
}

export interface EntitlementArea {
  id: 'focus' | 'today' | 'projects' | 'plan' | 'move' | 'life' | 'reports' | 'account';
  titleKey: TKey;
  rows: EntitlementRow[];
}

const yes: ComparisonValue = { kind: 'check' };
const no: ComparisonValue = { kind: 'dash' };
const limit = (value: number): ComparisonValue => ({ kind: 'limit', value });
const text = (key: TKey): ComparisonValue => ({ kind: 'key', key });
const unlimited = text('pricing.unlimited');

export function getEntitlements(): EntitlementArea[] {
  return [
    {
      id: 'focus',
      titleKey: 'plan.ent.area.focus',
      rows: [
        { labelKey: 'plan.ent.focusSessions', free: unlimited, pro: unlimited },
        {
          labelKey: 'plan.ent.sounds',
          free: limit(FREE_AMBIENT.length),
          pro: limit(AMBIENT_IDS.length),
        },
        { labelKey: 'plan.ent.soundMix', free: no, pro: yes },
        { labelKey: 'pay.plan.monthly.f6', free: no, pro: yes },
      ],
    },
    {
      id: 'today',
      titleKey: 'plan.ent.area.today',
      rows: [
        {
          labelKey: 'pricing.row.ivy',
          free: limit(FREE_LIMITS.ivyTasks),
          pro: limit(FREE_LIMITS.ivyMax),
        },
        { labelKey: 'plan.ent.todayStats', free: no, pro: yes },
      ],
    },
    {
      id: 'projects',
      titleKey: 'plan.ent.area.projects',
      rows: [
        { labelKey: 'plan.ent.projects', free: limit(FREE_LIMITS.projects), pro: unlimited },
        {
          labelKey: 'plan.ent.templates',
          free: text('plan.ent.v.some'),
          pro: text('plan.ent.v.all'),
        },
        { labelKey: 'pay.plan.monthly.f4', free: no, pro: yes },
      ],
    },
    {
      id: 'plan',
      titleKey: 'plan.ent.area.plan',
      rows: [
        { labelKey: 'plan.ent.goals', free: limit(FREE_LIMITS.goals), pro: unlimited },
        { labelKey: 'plan.ent.okrs', free: limit(FREE_LIMITS.okrs), pro: unlimited },
        { labelKey: 'plan.ent.skills', free: limit(FREE_LIMITS.skills), pro: unlimited },
        { labelKey: 'pricing.row.plan', free: limit(FREE_LIMITS.roadmaps), pro: unlimited },
        {
          labelKey: 'plan.ent.assistant',
          free: text('plan.ent.v.quick'),
          pro: text('plan.ent.v.fullChat'),
        },
      ],
    },
    {
      id: 'move',
      titleKey: 'plan.ent.area.move',
      rows: [
        {
          labelKey: 'plan.ent.moveLibrary',
          labelVars: { n: EXERCISES.length },
          free: yes,
          pro: yes,
        },
        { labelKey: 'plan.ent.moveWorkouts', free: yes, pro: yes },
        {
          labelKey: 'plan.ent.moveRoutines',
          labelVars: { n: MAX_CUSTOM },
          free: no,
          pro: yes,
        },
        { labelKey: 'plan.ent.moveRecords', free: no, pro: yes },
        {
          labelKey: 'plan.ent.moveMap',
          free: text('plan.ent.v.days7'),
          pro: text('plan.ent.v.days30'),
        },
        { labelKey: 'plan.ent.moveProgram', free: no, pro: yes },
      ],
    },
    {
      id: 'life',
      titleKey: 'plan.ent.area.life',
      rows: [
        { labelKey: 'plan.ent.habits', free: limit(FREE_LIMITS.habits), pro: unlimited },
        { labelKey: 'plan.ent.lifeBasics', free: yes, pro: yes },
        { labelKey: 'plan.ent.lifeInsights', free: no, pro: yes },
      ],
    },
    {
      id: 'reports',
      titleKey: 'plan.ent.area.reports',
      rows: [
        { labelKey: 'pricing.row.insights', free: limit(FREE_LIMITS.insights), pro: unlimited },
        { labelKey: 'pay.plan.monthly.f3', free: no, pro: yes },
        { labelKey: 'pricing.row.jsonExport', free: yes, pro: yes },
      ],
    },
    {
      id: 'account',
      titleKey: 'plan.ent.area.account',
      rows: [
        {
          labelKey: 'pricing.row.sync',
          free: text('pricing.sync.free'),
          pro: text('pricing.sync.pro'),
        },
        { labelKey: 'plan.ent.calendar', free: no, pro: yes },
        { labelKey: 'pay.plan.monthly.f7', free: no, pro: yes },
      ],
    },
  ];
}

/** Which plan the account is on, as shown in Settings (gift = complimentary Pro). */
export function currentPlanOf(
  isPro: boolean,
  sub: { planId: 'free' | 'pro-monthly' | 'pro-yearly'; isPro: boolean },
): 'free' | 'pro-monthly' | 'pro-yearly' | 'pro-gift' {
  if (!isPro) return 'free';
  if (!sub.isPro || sub.planId === 'free') return 'pro-gift';
  return sub.planId;
}
