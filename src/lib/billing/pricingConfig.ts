/**
 * Single source of truth for pricing display + Pro gating.
 *
 * Read by: UI paywalls, the public /pricing route and every upgrade copy.
 * Do not hardcode prices, limits or feature lists elsewhere — import here.
 *
 * Enforcement limits themselves live in their domain modules
 * (projects, goals, okrs, habits, skills, ivyLee, insights); this file
 * re-exports them so display copy can never drift (see pricingConfig.test.ts).
 * The module is pure and local-first safe: no network, no secrets.
 */

import type { TKey } from '../i18n/types';
import { FREE_PROJECTS_LIMIT } from '../projects';
import { FREE_GOALS_LIMIT } from '../goals';
import { FREE_OKRS_LIMIT } from '../okrs';
import { FREE_HABITS_LIMIT } from '../habits';
import { FREE_SKILLS_LIMIT } from '../skills';
import { IVY_MAX_TASKS, IVY_FREE_MAX_TASKS } from '../ivyLee';
import { CORE_INSIGHT_LIMIT } from '../insights';
import { FREE_ROADMAPS_LIMIT, canAddRoadmap } from '../roadmapLimits';

export { FREE_ROADMAPS_LIMIT, canAddRoadmap };

export type PlanId = 'free' | 'pro-monthly' | 'pro-yearly';

export interface PricingPlanDisplay {
  id: PlanId;
  /** English plan name (checkout metadata). UI renders `nameKey`. */
  name: string;
  nameKey: TKey;
  /** Display price, e.g. "$5.99". Currency formatting stays literal. */
  price: string;
  /** Per-period suffix key (null for Free). */
  perKey: TKey | null;
  descKey: TKey;
  featureKeys: TKey[];
}

import { PLAN_FEATURE_KEYS, PRO_PRICES, trialDays } from './prices';
import { readEnv } from '../env';

/** Trial length shown on paid plans; 0 hides every trial mention. */
export function proTrialDays(): number {
  return trialDays(readEnv().VITE_PRO_TRIAL_DAYS);
}
export { FREE_PRICE, PRO_PRICES, SYNC_NOTE_KEY, SYNC_SCOPE_KEY } from './prices';

export const PRICING_PLANS_DISPLAY: PricingPlanDisplay[] = [
  {
    id: 'free',
    name: 'Free',
    nameKey: 'pricing.plan.free.name',
    price: '$0',
    perKey: null,
    descKey: 'pay.plan.free.desc',
    featureKeys: [...PLAN_FEATURE_KEYS.free],
  },
  {
    id: 'pro-monthly',
    name: 'Pro (Monthly)',
    nameKey: 'pricing.plan.proMonthly.name',
    price: PRO_PRICES.monthly,
    perKey: 'pay.perMonth',
    descKey: 'pay.plan.monthly.desc',
    featureKeys: [...PLAN_FEATURE_KEYS.proMonthly],
  },
  {
    id: 'pro-yearly',
    name: 'Pro (Yearly)',
    nameKey: 'pricing.plan.proYearly.name',
    price: PRO_PRICES.yearly,
    perKey: 'pay.perYear',
    descKey: 'pay.plan.yearly.desc',
    featureKeys: [...PLAN_FEATURE_KEYS.proYearly],
  },
];

export function getPlanDisplay(id: PlanId): PricingPlanDisplay | undefined {
  return PRICING_PLANS_DISPLAY.find((p) => p.id === id);
}

/** Display-facing re-export of the enforced Free limits. */
export const FREE_LIMITS = {
  projects: FREE_PROJECTS_LIMIT,
  goals: FREE_GOALS_LIMIT,
  okrs: FREE_OKRS_LIMIT,
  habits: FREE_HABITS_LIMIT,
  skills: FREE_SKILLS_LIMIT,
  ivyTasks: IVY_FREE_MAX_TASKS,
  ivyMax: IVY_MAX_TASKS,
  insights: CORE_INSIGHT_LIMIT,
  roadmaps: FREE_ROADMAPS_LIMIT,
} as const;

/**
 * Free vs Pro (keep gating + pay.* copy aligned):
 *
 * FREE — Focus forever; 3 projects / 3 goals / 3 OKRs / 5 habits / 5 skills;
 * Ivy 3/day; 2 assistant quick actions; 1 local plan (no own-key AI);
 * 2 core Insights; classic Focus atmospheres free; with an account, sessions,
 * areas and settings sync; everything else stays on the device.
 *
 * PRO — unlimited entities; full chat + tones + voice; own-key plans;
 * all Insights; CSV/PDF export (full JSON data export is free); time blocks + sprint charts + kanban WIP;
 * full account sync (every planning store in `sync/proCollections.ts` on top of
 * sessions/areas/settings); light / accents / Pro fonts; interior Pro atmosphere packs.
 *
 * Soft promises (beta invites / priority support) are operational, not code gates.
 */
/* ---------------- Pro gating (pure, testable) ---------------- */

/** CSV timesheet export is Pro. Free callers are blocked with an upsell. */
export function canExportSessions(isPro: boolean): boolean {
  return isPro;
}

/** Printable PDF report is Pro, same gate as CSV. */
export function canPrintReport(isPro: boolean): boolean {
  return isPro;
}

/** Own-key AI providers (Gemini / OpenAI / DeepSeek) are Pro. Free = local only. */
export function canUseByokAi(isPro: boolean): boolean {
  return isPro;
}

/* ---------------- Complimentary Pro (not Lemon-paid) ---------------- */
export { fetchComplimentaryPro, resolveIsPro } from './complimentaryPro';

/* ---------------- /pricing comparison table ---------------- */

export type ComparisonValue =
  | { kind: 'check' }
  | { kind: 'dash' }
  | { kind: 'limit'; value: number }
  | { kind: 'key'; key: TKey };

export interface ComparisonRow {
  labelKey: TKey;
  free: ComparisonValue;
  pro: ComparisonValue;
}

/**
 * Free vs Pro rows. Labels reuse the marketed pay.* keys so the table can
 * never describe a different feature set than the paywalls; numeric values
 * come from FREE_LIMITS so a limit change updates the table automatically.
 */
export function getComparisonRows(): ComparisonRow[] {
  return [
    {
      labelKey: 'pay.plan.monthly.f1',
      free: { kind: 'limit', value: FREE_LIMITS.projects },
      pro: { kind: 'key', key: 'pricing.unlimited' },
    },
    {
      labelKey: 'pricing.row.ivy',
      free: { kind: 'limit', value: FREE_LIMITS.ivyTasks },
      pro: { kind: 'limit', value: FREE_LIMITS.ivyMax },
    },
    {
      labelKey: 'pricing.row.plan',
      free: { kind: 'limit', value: FREE_LIMITS.roadmaps },
      pro: { kind: 'key', key: 'pricing.unlimited' },
    },
    {
      labelKey: 'pricing.row.insights',
      free: { kind: 'limit', value: FREE_LIMITS.insights },
      pro: { kind: 'key', key: 'pricing.unlimited' },
    },
    {
      labelKey: 'pay.plan.monthly.f2',
      free: { kind: 'dash' },
      pro: { kind: 'check' },
    },
    {
      labelKey: 'pricing.row.jsonExport',
      free: { kind: 'check' },
      pro: { kind: 'check' },
    },
    {
      labelKey: 'pay.plan.monthly.f3',
      free: { kind: 'dash' },
      pro: { kind: 'check' },
    },
    {
      labelKey: 'pay.plan.monthly.f4',
      free: { kind: 'dash' },
      pro: { kind: 'check' },
    },
    {
      labelKey: 'pay.plan.monthly.f8',
      free: { kind: 'dash' },
      pro: { kind: 'check' },
    },
    {
      labelKey: 'pricing.row.sync',
      free: { kind: 'key', key: 'pricing.sync.free' },
      pro: { kind: 'key', key: 'pricing.sync.pro' },
    },
    {
      labelKey: 'pay.plan.monthly.f6',
      free: { kind: 'dash' },
      pro: { kind: 'check' },
    },
    {
      labelKey: 'pay.plan.monthly.f7',
      free: { kind: 'dash' },
      pro: { kind: 'check' },
    },
  ];
}
