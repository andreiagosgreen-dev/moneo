/* Technical skills tracking (Roadmap Phase 1.2) — local-first, additive. */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { projectCompletion, type Task } from './tasks';
import type { Project } from './projects';
import type { Goal } from './goals';
import type { TKey } from './i18n/types';

export type SkillCategory =
  'frontend' | 'backend' | 'mobile' | 'devops' | 'data' | 'design' | 'soft' | 'other';

export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  /** Self-assessed current level, 1 (beginner) to 5 (expert). */
  level: SkillLevel;
  /** Desired level; progress is measured against it. */
  targetLevel: SkillLevel;
  /** Manually logged learning minutes (focus sessions stay project-scoped). */
  minutesLogged: number;
  /** Motivational XP total (Faza 17) — never decreases, no punitive mechanics. */
  xp: number;
  /** Learning resources: URLs or short notes (max 8, like project tags). */
  resources: string[];
  /** Certification earned for this skill. */
  certified?: boolean;
  createdAt: number;
  updatedAt: number;
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  'frontend',
  'backend',
  'mobile',
  'devops',
  'data',
  'design',
  'soft',
  'other',
];

export const CATEGORY_LABELS: Record<SkillCategory, TKey> = {
  frontend: 'skills.category.frontend',
  backend: 'skills.category.backend',
  mobile: 'skills.category.mobile',
  devops: 'skills.category.devops',
  data: 'skills.category.data',
  design: 'skills.category.design',
  soft: 'skills.category.soft',
  other: 'skills.category.other',
};

export const LEVEL_LABELS: Record<SkillLevel, TKey> = {
  1: 'skills.level.1',
  2: 'skills.level.2',
  3: 'skills.level.3',
  4: 'skills.level.4',
  5: 'skills.level.5',
};

/** Free tier tracks a handful of skills; Pro is unlimited. */
export const FREE_SKILLS_LIMIT = 5;

export const MAX_RESOURCES = 8;

function clampLevel(n: unknown, fallback: SkillLevel): SkillLevel {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5 ? n : fallback;
}

/** Load skills, defaulting additive fields so legacy payloads stay valid. */
export function loadSkills(): Skill[] {
  const stored = read<Skill[]>(STORAGE_KEYS.skills);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string')
    .map((s) => ({
      id: s.id,
      name: s.name,
      category: SKILL_CATEGORIES.includes(s.category as SkillCategory)
        ? (s.category as SkillCategory)
        : 'other',
      level: clampLevel(s.level, 1),
      targetLevel: clampLevel(s.targetLevel, 3),
      minutesLogged:
        typeof s.minutesLogged === 'number' && Number.isFinite(s.minutesLogged)
          ? Math.max(0, Math.floor(s.minutesLogged))
          : 0,
      xp: typeof s.xp === 'number' && Number.isFinite(s.xp) ? Math.max(0, Math.floor(s.xp)) : 0,
      resources: Array.isArray(s.resources)
        ? s.resources.filter((r) => typeof r === 'string').slice(0, MAX_RESOURCES)
        : [],
      ...(s.certified === true ? { certified: true as const } : {}),
      createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
      updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
    }));
}

export function saveSkills(skills: Skill[]): boolean {
  return write(STORAGE_KEYS.skills, skills);
}

/** Create a skill object (persistence is the caller's job via saveSkills). */
export function createSkillObject(name: string, category: SkillCategory = 'other'): Skill {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    category,
    level: 1,
    targetLevel: 3,
    minutesLogged: 0,
    xp: 0,
    resources: [],
    createdAt: now,
    updatedAt: now,
  };
}

export interface SkillUpdates {
  name?: string;
  category?: SkillCategory;
  level?: SkillLevel;
  targetLevel?: SkillLevel;
  certified?: boolean;
}

/** Apply updates to an existing skill; returns the list unchanged when missing. */
export function updateSkill(skills: Skill[], id: string, updates: SkillUpdates): Skill[] {
  return skills.map((s) => {
    if (s.id !== id) return s;
    const next: Skill = { ...s, updatedAt: Date.now() };
    if (updates.name !== undefined) next.name = updates.name.trim() || s.name;
    if (updates.category !== undefined) next.category = updates.category;
    if (updates.level !== undefined) next.level = clampLevel(updates.level, s.level);
    if (updates.targetLevel !== undefined)
      next.targetLevel = clampLevel(updates.targetLevel, s.targetLevel);
    if (updates.certified !== undefined) {
      if (updates.certified) next.certified = true;
      else delete next.certified;
    }
    return next;
  });
}

export function deleteSkill(skills: Skill[], id: string): Skill[] {
  return skills.filter((s) => s.id !== id);
}

/** XP range per logged session (Faza 17) — slightly unpredictable, never punitive. */
export const XP_MIN_PER_SESSION = 8;
export const XP_MAX_PER_SESSION = 15;

/** A small random XP award in [XP_MIN_PER_SESSION, XP_MAX_PER_SESSION]. Never negative. */
export function rollSessionXp(): number {
  const span = XP_MAX_PER_SESSION - XP_MIN_PER_SESSION;
  return XP_MIN_PER_SESSION + Math.floor(Math.random() * (span + 1));
}

/**
 * Add learning minutes (Pomodoro-sized chunks from the UI) and award a
 * small, variable XP bonus for the logged session — no punitive mechanics,
 * XP only ever grows. Ignores junk input.
 */
export function logLearningMinutes(
  skills: Skill[],
  id: string,
  minutes: number,
): { skills: Skill[]; xpGained: number } {
  if (!Number.isFinite(minutes) || minutes <= 0) return { skills, xpGained: 0 };
  const chunk = Math.min(Math.floor(minutes), 24 * 60);
  const xpGained = rollSessionXp();
  const next = skills.map((s) =>
    s.id === id
      ? { ...s, minutesLogged: s.minutesLogged + chunk, xp: s.xp + xpGained, updatedAt: Date.now() }
      : s,
  );
  return { skills: next, xpGained };
}

/** Append a resource URL/note; capped at MAX_RESOURCES, deduped. */
export function addResource(skills: Skill[], id: string, resource: string): Skill[] {
  const clean = resource.trim();
  if (!clean) return skills;
  return skills.map((s) => {
    if (s.id !== id || s.resources.includes(clean)) return s;
    return {
      ...s,
      resources: [...s.resources, clean].slice(0, MAX_RESOURCES),
      updatedAt: Date.now(),
    };
  });
}

/** Progress toward the target level as 0..1 (level 5 is always complete). */
export function skillProgress(skill: Skill): number {
  if (skill.targetLevel <= 1) return 1;
  const span = skill.targetLevel - 1;
  return Math.min(1, Math.max(0, (skill.level - 1) / span));
}

export function totalLearningMinutes(skills: Skill[]): number {
  return skills.reduce((sum, s) => sum + s.minutesLogged, 0);
}

export function skillsByCategory(
  skills: Skill[],
): Array<{ category: SkillCategory; count: number }> {
  const counts = new Map<SkillCategory, number>();
  for (const s of skills) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export function formatLearningDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/* ---------------- technical → business transition (Roadmap 4.5) ---------------- */

/**
 * Detect when technical foundations look solid (top-3 skills averaging
 * Competent+ with shipped project work) but no business goal exists yet,
 * and suggest the transition. Rule-based. Never throws.
 */
export function transitionAdvice(
  skills: Skill[],
  tasks: Task[],
  projects: Project[],
  goals: Goal[],
): string | null {
  if (skills.length < 3) return null;
  const top = skills
    .slice()
    .sort((a, b) => b.level - a.level)
    .slice(0, 3);
  const avg = top.reduce((sum, s) => sum + s.level, 0) / top.length;
  if (avg < 3) return null;
  const shipped = projects.filter((p) => {
    const { done } = projectCompletion(tasks, p.id);
    return done >= 2;
  }).length;
  if (shipped < 2) return null;
  const hasBusiness = goals.some(
    (g) =>
      !g.archived && /market|sales|business|client|customer|brand|launch|revenue/i.test(g.title),
  );
  if (hasBusiness) return null;
  return `Your top skills (${top.map((s) => s.name).join(', ')}) are solid and ${shipped} projects shipped work — time to add a business goal (marketing, sales, clients) alongside the technical ones.`;
}
