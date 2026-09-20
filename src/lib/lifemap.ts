/**
 * Life Map (Roadmap Faza 3) — the signature experience connecting daily
 * focus with life balance. Local-first and LOCAL-ONLY by design: areas
 * never sync (no RLS tables exist for them), and the UI says so.
 *
 * Each area scores itself 1..10 now vs desired, weighted by importance.
 * The map turns the biggest important gap into one concrete 10-minute
 * next step, and the weekly review shows what actually got attention.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { createI18n, type I18n } from './i18n';

/** Default English translator — keeps lib helpers usable without a provider. */
const EN_I18N = createI18n('en');

/** Locale-aware "A and B" join for area names (ES2020-safe, no ListFormat). */
function joinNames(names: string[], locale: string): string {
  if (names.length <= 1) return names.join('');
  const and: Record<string, string> = {
    en: ' and ',
    ro: ' și ',
    ru: ' и ',
    uk: ' та ',
    de: ' und ',
    it: ' e ',
    fr: ' et ',
    es: ' y ',
  };
  return names.join(and[locale] ?? ' and ');
}

export interface LifeMapArea {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** How this area feels now, 1..10. */
  currentScore: number;
  /** Where it should be, 1..10. */
  desiredScore: number;
  /** How much this area matters, 1..5. */
  importance: number;
  /** One-sentence intention. */
  intention: string;
  linkedGoalIds: string[];
  linkedProjectIds: string[];
  linkedHabitIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface LifeMapTemplate {
  id: string;
  name: string;
  hint: string;
  areas: Array<{
    name: string;
    icon: string;
    color: string;
    currentScore: number;
    desiredScore: number;
    importance: number;
    intention: string;
  }>;
}

const PALETTE = ['#3ecf8e', '#7aa5ff', '#f5a524', '#f483b8', '#a78bfa', '#5eead4'];

export const LIFE_MAP_TEMPLATES: LifeMapTemplate[] = [
  {
    id: 'balanced',
    name: 'Balanced life',
    hint: 'Body, mind, people and work in one view',
    areas: [
      {
        name: 'Health',
        icon: '❤️',
        color: PALETTE[0],
        currentScore: 6,
        desiredScore: 8,
        importance: 5,
        intention: 'Move a little every day.',
      },
      {
        name: 'Relationships',
        icon: '🧡',
        color: PALETTE[3],
        currentScore: 6,
        desiredScore: 8,
        importance: 4,
        intention: 'Call one person this week.',
      },
      {
        name: 'Learning',
        icon: '📚',
        color: PALETTE[1],
        currentScore: 5,
        desiredScore: 7,
        importance: 4,
        intention: 'Read ten pages daily.',
      },
      {
        name: 'Work',
        icon: '💼',
        color: PALETTE[2],
        currentScore: 7,
        desiredScore: 8,
        importance: 4,
        intention: 'Protect deep mornings.',
      },
      {
        name: 'Money',
        icon: '💰',
        color: PALETTE[5],
        currentScore: 5,
        desiredScore: 7,
        importance: 3,
        intention: 'Save a fixed share.',
      },
      {
        name: 'Rest',
        icon: '😴',
        color: PALETTE[4],
        currentScore: 5,
        desiredScore: 8,
        importance: 4,
        intention: 'Lights out by eleven.',
      },
    ],
  },
  {
    id: 'student',
    name: 'Student',
    hint: 'Study, health and friends during term time',
    areas: [
      {
        name: 'Study',
        icon: '📚',
        color: PALETTE[1],
        currentScore: 6,
        desiredScore: 9,
        importance: 5,
        intention: 'Two focused blocks daily.',
      },
      {
        name: 'Health',
        icon: '❤️',
        color: PALETTE[0],
        currentScore: 5,
        desiredScore: 7,
        importance: 4,
        intention: 'Walk between lectures.',
      },
      {
        name: 'Friends',
        icon: '🧡',
        color: PALETTE[3],
        currentScore: 6,
        desiredScore: 8,
        importance: 4,
        intention: 'One evening out weekly.',
      },
      {
        name: 'Money',
        icon: '💰',
        color: PALETTE[5],
        currentScore: 4,
        desiredScore: 6,
        importance: 3,
        intention: 'Track every expense.',
      },
      {
        name: 'Rest',
        icon: '😴',
        color: PALETTE[4],
        currentScore: 5,
        desiredScore: 8,
        importance: 4,
        intention: 'No screens after midnight.',
      },
    ],
  },
  {
    id: 'freelancer',
    name: 'Freelancer',
    hint: 'Clients, pipeline and staying human',
    areas: [
      {
        name: 'Clients',
        icon: '💼',
        color: PALETTE[2],
        currentScore: 7,
        desiredScore: 8,
        importance: 5,
        intention: 'Reply within a day.',
      },
      {
        name: 'Pipeline',
        icon: '📈',
        color: PALETTE[1],
        currentScore: 5,
        desiredScore: 8,
        importance: 5,
        intention: 'Two outreach touches weekly.',
      },
      {
        name: 'Craft',
        icon: '🎨',
        color: PALETTE[4],
        currentScore: 6,
        desiredScore: 8,
        importance: 4,
        intention: 'Ship one improvement weekly.',
      },
      {
        name: 'Health',
        icon: '❤️',
        color: PALETTE[0],
        currentScore: 5,
        desiredScore: 7,
        importance: 4,
        intention: 'Lunch away from the desk.',
      },
      {
        name: 'Rest',
        icon: '😴',
        color: PALETTE[4],
        currentScore: 4,
        desiredScore: 7,
        importance: 3,
        intention: 'Weekends stay work-free.',
      },
    ],
  },
  {
    id: 'founder',
    name: 'Founder',
    hint: 'Product, growth and personal runway',
    areas: [
      {
        name: 'Product',
        icon: '🚀',
        color: PALETTE[2],
        currentScore: 6,
        desiredScore: 9,
        importance: 5,
        intention: 'One shippable slice weekly.',
      },
      {
        name: 'Growth',
        icon: '📈',
        color: PALETTE[1],
        currentScore: 5,
        desiredScore: 8,
        importance: 5,
        intention: 'Talk to one user daily.',
      },
      {
        name: 'Runway',
        icon: '💰',
        color: PALETTE[5],
        currentScore: 5,
        desiredScore: 7,
        importance: 4,
        intention: 'Know the months left.',
      },
      {
        name: 'Health',
        icon: '❤️',
        color: PALETTE[0],
        currentScore: 4,
        desiredScore: 7,
        importance: 4,
        intention: 'Exercise three times weekly.',
      },
      {
        name: 'Family',
        icon: '👪',
        color: PALETTE[3],
        currentScore: 5,
        desiredScore: 8,
        importance: 5,
        intention: 'Dinner together daily.',
      },
    ],
  },
  {
    id: 'recovery',
    name: 'Recovery',
    hint: 'Gentle rebuild after burnout or illness',
    areas: [
      {
        name: 'Sleep',
        icon: '😴',
        color: PALETTE[4],
        currentScore: 4,
        desiredScore: 8,
        importance: 5,
        intention: 'Same bedtime nightly.',
      },
      {
        name: 'Movement',
        icon: '🚶',
        color: PALETTE[0],
        currentScore: 3,
        desiredScore: 6,
        importance: 4,
        intention: 'Ten gentle minutes.',
      },
      {
        name: 'People',
        icon: '🧡',
        color: PALETTE[3],
        currentScore: 4,
        desiredScore: 7,
        importance: 4,
        intention: 'One low-key visit weekly.',
      },
      {
        name: 'Calm work',
        icon: '🌿',
        color: PALETTE[5],
        currentScore: 3,
        desiredScore: 6,
        importance: 3,
        intention: 'Ninety minutes, then stop.',
      },
    ],
  },
  {
    id: 'blank',
    name: 'Blank',
    hint: 'Start empty and add your own areas',
    areas: [],
  },
];

function clampScore(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(10, Math.max(1, Math.round(v))) : 5;
}

function clampImportance(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(5, Math.max(1, Math.round(v))) : 3;
}

function cleanIdList(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
}

export function loadLifeMap(): LifeMapArea[] {
  const stored = read<LifeMapArea[]>(STORAGE_KEYS.lifeMap);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((a) => a && typeof a.id === 'string' && typeof a.name === 'string')
    .map((a) => ({
      id: a.id,
      name: a.name.slice(0, 40),
      color: typeof a.color === 'string' && a.color ? a.color : PALETTE[0],
      icon: typeof a.icon === 'string' && a.icon ? a.icon.slice(0, 8) : '◎',
      currentScore: clampScore(a.currentScore),
      desiredScore: clampScore(a.desiredScore),
      importance: clampImportance(a.importance),
      intention: typeof a.intention === 'string' ? a.intention.slice(0, 140) : '',
      linkedGoalIds: cleanIdList(a.linkedGoalIds),
      linkedProjectIds: cleanIdList(a.linkedProjectIds),
      linkedHabitIds: cleanIdList(a.linkedHabitIds),
      createdAt: typeof a.createdAt === 'number' ? a.createdAt : Date.now(),
      updatedAt: typeof a.updatedAt === 'number' ? a.updatedAt : Date.now(),
    }));
}

export function saveLifeMap(areas: LifeMapArea[]): boolean {
  return write(STORAGE_KEYS.lifeMap, areas);
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `lm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Instantiate a template into editable areas (ids are fresh every time). */
export function instantiateTemplate(templateId: string): LifeMapArea[] {
  const template = LIFE_MAP_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return [];
  const now = Date.now();
  return template.areas.map((a) => ({
    id: newId(),
    name: a.name,
    color: a.color,
    icon: a.icon,
    currentScore: a.currentScore,
    desiredScore: a.desiredScore,
    importance: a.importance,
    intention: a.intention,
    linkedGoalIds: [],
    linkedProjectIds: [],
    linkedHabitIds: [],
    createdAt: now,
    updatedAt: now,
  }));
}

export interface AreaUpdates {
  name?: string;
  color?: string;
  icon?: string;
  currentScore?: number;
  desiredScore?: number;
  importance?: number;
  intention?: string;
  linkedGoalIds?: string[];
  linkedProjectIds?: string[];
  linkedHabitIds?: string[];
}

export function createLifeMapArea(name: string): LifeMapArea | null {
  const clean = name.trim().slice(0, 40);
  if (!clean) return null;
  const now = Date.now();
  return {
    id: newId(),
    name: clean,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    icon: '◎',
    currentScore: 5,
    desiredScore: 8,
    importance: 3,
    intention: '',
    linkedGoalIds: [],
    linkedProjectIds: [],
    linkedHabitIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function updateLifeMapArea(
  areas: LifeMapArea[],
  id: string,
  updates: AreaUpdates,
): LifeMapArea[] {
  return areas.map((a) => {
    if (a.id !== id) return a;
    const next: LifeMapArea = { ...a, updatedAt: Date.now() };
    if (updates.name !== undefined) next.name = updates.name.trim().slice(0, 40) || a.name;
    if (updates.color !== undefined && updates.color) next.color = updates.color;
    if (updates.icon !== undefined) next.icon = updates.icon.slice(0, 8) || '◎';
    if (updates.currentScore !== undefined) next.currentScore = clampScore(updates.currentScore);
    if (updates.desiredScore !== undefined) next.desiredScore = clampScore(updates.desiredScore);
    if (updates.importance !== undefined) next.importance = clampImportance(updates.importance);
    if (updates.intention !== undefined) next.intention = updates.intention.trim().slice(0, 140);
    if (updates.linkedGoalIds !== undefined)
      next.linkedGoalIds = cleanIdList(updates.linkedGoalIds);
    if (updates.linkedProjectIds !== undefined) {
      next.linkedProjectIds = cleanIdList(updates.linkedProjectIds);
    }
    if (updates.linkedHabitIds !== undefined) {
      next.linkedHabitIds = cleanIdList(updates.linkedHabitIds);
    }
    return next;
  });
}

export function deleteLifeMapArea(areas: LifeMapArea[], id: string): LifeMapArea[] {
  return areas.filter((a) => a.id !== id);
}

/** Move an area earlier (-) or later (+) in display order. Pure. */
export function reorderLifeMapArea(areas: LifeMapArea[], id: string, dir: -1 | 1): LifeMapArea[] {
  const idx = areas.findIndex((a) => a.id === id);
  const swap = idx + dir;
  if (idx < 0 || swap < 0 || swap >= areas.length) return areas;
  const next = areas.slice();
  [next[idx], next[swap]] = [next[swap], next[idx]];
  return next;
}

/* ---------------- scoring: gap → next step → balance ---------------- */

/** Weighted gap: how far behind desire, scaled by importance (0 when met). */
export function areaGap(area: LifeMapArea): number {
  return Math.max(0, area.desiredScore - area.currentScore) * area.importance;
}

export interface NextStep {
  area: LifeMapArea;
  /** Concrete 10-minute suggestion derived from the area intention. */
  text: string;
}

/**
 * The single most important neglected area becomes one concrete 10-minute
 * step. Null when every area meets its desire. Never throws.
 */
export function suggestNextStep(areas: LifeMapArea[]): NextStep | null {
  if (!Array.isArray(areas) || areas.length === 0) return null;
  const ranked = areas
    .slice()
    .sort((a, b) => areaGap(b) - areaGap(a) || b.importance - a.importance);
  const top = ranked[0];
  if (areaGap(top) <= 0) return null;
  const intention = top.intention.trim();
  return {
    area: top,
    text: intention ? `10 minutes for ${top.name}: ${intention}` : `10 minutes for ${top.name}.`,
  };
}

export interface LifeBalance {
  /** 0-100 across areas: current vs desired, importance-weighted. */
  score: number;
  /** One calm insight sentence for the wheel center. */
  insight: string;
  /** The area the insight refers to (null when balanced or empty). */
  focusArea: LifeMapArea | null;
}

/** Center-of-wheel number + sentence. Never throws. */
export function lifeBalance(areas: LifeMapArea[], i18n: I18n = EN_I18N): LifeBalance {
  const list = Array.isArray(areas) ? areas : [];
  if (list.length === 0) {
    return { score: 0, insight: i18n.t('lifemap.balance.empty'), focusArea: null };
  }
  let weight = 0;
  let filled = 0;
  for (const a of list) {
    weight += a.importance;
    filled += (a.currentScore / Math.max(1, a.desiredScore)) * a.importance;
  }
  const score = weight > 0 ? Math.min(100, Math.round((filled / weight) * 100)) : 0;
  const step = suggestNextStep(areas);
  if (!step) {
    return { score, insight: i18n.t('lifemap.balance.all'), focusArea: null };
  }
  return {
    score,
    insight: i18n.t('lifemap.balance.gap', { name: step.area.name }),
    focusArea: step.area,
  };
}

/* ---------------- weekly review ---------------- */

export interface AreaAttention {
  area: LifeMapArea;
  minutes: number;
  habitHits: number;
  attended: boolean;
  /** Minutes attended in the 7 days before this window, for trend comparison. */
  previousMinutes: number;
}

export interface WeeklyReview {
  attended: AreaAttention[];
  neglected: LifeMapArea[];
  summary: string;
  /** Total attended minutes across all areas this week. */
  totalMinutes: number;
  /** Same total for the trailing 7 days before this week, for trend comparison. */
  previousTotalMinutes: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What got attention in the trailing 7 days, from measured data only:
 * focus minutes in linked projects + completions in linked habits.
 * Tone is observational, never moralizing. Never throws.
 */
export function weeklyReview(
  areas: LifeMapArea[],
  history: Array<{ at: number; min: number; projectId?: string }>,
  habitLog: Record<string, string[]>,
  now: number = Date.now(),
  i18n: I18n = EN_I18N,
): WeeklyReview {
  const start = now - 7 * DAY_MS;
  const prevStart = start - 7 * DAY_MS;
  const list = Array.isArray(areas) ? areas : [];
  const validHistory = Array.isArray(history) && Number.isFinite(now);
  const inWindow = (from: number, to: number) =>
    validHistory
      ? history.filter(
          (s) =>
            s && typeof s.at === 'number' && typeof s.min === 'number' && s.at >= from && s.at < to,
        )
      : [];
  const inWeek = inWindow(start, now + 1);
  const inPrevWeek = inWindow(prevStart, start);
  const log = habitLog && typeof habitLog === 'object' ? habitLog : {};

  const minutesFor = (sessions: typeof inWeek, projectIds: Set<string>) =>
    sessions
      .filter((s) => s.projectId && projectIds.has(s.projectId))
      .reduce((sum, s) => sum + s.min, 0);

  const rows: AreaAttention[] = list.map((area) => {
    const projectIds = new Set(area.linkedProjectIds);
    const minutes = minutesFor(inWeek, projectIds);
    const previousMinutes = minutesFor(inPrevWeek, projectIds);
    let habitHits = 0;
    for (const hid of area.linkedHabitIds) {
      const days = log[hid];
      if (!Array.isArray(days)) continue;
      for (const key of days) {
        const [y, m, d] = String(key).split('-').map(Number);
        if (!y || !m || !d) continue;
        const ts = new Date(y, m - 1, d).getTime();
        if (ts >= start - DAY_MS && ts <= now) habitHits += 1;
      }
    }
    return { area, minutes, habitHits, attended: minutes > 0 || habitHits > 0, previousMinutes };
  });

  const attended = rows
    .filter((r) => r.attended)
    .sort((a, b) => b.minutes + b.habitHits * 25 - (a.minutes + a.habitHits * 25));
  const neglected = rows
    .filter((r) => !r.attended)
    .map((r) => r.area)
    .sort((a, b) => b.importance - a.importance || areaGap(b) - areaGap(a));

  let summary: string;
  if (list.length === 0) {
    summary = i18n.t('lifemap.review.none');
  } else if (neglected.length === 0) {
    summary = i18n.t('lifemap.review.all');
  } else if (attended.length === 0) {
    summary = i18n.t('lifemap.review.quiet');
  } else {
    const names = joinNames(
      neglected.slice(0, 2).map((a) => a.name),
      i18n.locale,
    );
    summary = i18n.tp('lifemap.review.mixed', attended.length, { names });
  }
  const totalMinutes = rows.reduce((sum, r) => sum + r.minutes, 0);
  const previousTotalMinutes = rows.reduce((sum, r) => sum + r.previousMinutes, 0);
  return { attended, neglected, summary, totalMinutes, previousTotalMinutes };
}
