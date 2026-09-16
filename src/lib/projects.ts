/* Project management - extended implementation */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';

export type ProjectCategory = 'work' | 'personal' | 'learning' | 'clients';

export interface Project {
  id: string;
  name: string;
  color: string;
  category: ProjectCategory;
  /** Free-form tags for grouping and search (additive, optional). */
  tags: string[];
  /** Optional deadline in epoch ms (additive, optional). */
  deadline?: number;
  /** Archive hides the project from the active list without deleting history. */
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export const PROJECT_CATEGORIES: ProjectCategory[] = ['work', 'personal', 'learning', 'clients'];

export const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  work: 'Work',
  personal: 'Personal',
  learning: 'Learning',
  clients: 'Clients',
};

export const PROJECT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
];

export const FREE_PROJECTS_LIMIT = 3;

/** Load projects, defaulting additive fields so legacy payloads stay valid. */
export function loadProjects(): Project[] {
  const stored = read<Project[]>(STORAGE_KEYS.projects);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: typeof p.color === 'string' ? p.color : PROJECT_COLORS[0],
      category: PROJECT_CATEGORIES.includes(p.category as ProjectCategory)
        ? (p.category as ProjectCategory)
        : 'work',
      tags: Array.isArray(p.tags) ? p.tags.filter((t) => typeof t === 'string') : [],
      ...(typeof p.deadline === 'number' && Number.isFinite(p.deadline)
        ? { deadline: p.deadline }
        : {}),
      ...(typeof p.archived === 'boolean' ? { archived: p.archived } : {}),
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
    }));
}

export function saveProjects(projects: Project[]): boolean {
  return write(STORAGE_KEYS.projects, projects);
}

/** Create a new project object (persistence is the caller's job via saveProjects). */
export function createProjectObject(name: string, category: ProjectCategory): Project {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
    category,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Clone a project (new id, same name/color/category/tags, no history link). */
export function cloneProject(project: Project): Project {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: `${project.name} (copy)`,
    color: project.color,
    category: project.category,
    tags: [...project.tags],
    ...(typeof project.deadline === 'number' ? { deadline: project.deadline } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export interface ProjectUpdates {
  name?: string;
  color?: string;
  category?: ProjectCategory;
  tags?: string[]; // full replacement
  deadline?: number | null; // null removes the deadline
  archived?: boolean;
}

/** Apply updates to an existing project; returns the updated project when found. */
export function updateProject(projects: Project[], id: string, updates: ProjectUpdates): Project[] {
  return projects.map((p) => {
    if (p.id !== id) return p;
    const next: Project = { ...p, updatedAt: Date.now() };
    if (updates.name !== undefined) next.name = updates.name.trim() || p.name;
    if (updates.color !== undefined) next.color = updates.color;
    if (updates.category !== undefined) next.category = updates.category;
    if (updates.tags !== undefined) next.tags = updates.tags.filter((t) => t.trim().length > 0);
    if (updates.deadline !== undefined) {
      if (updates.deadline !== null) next.deadline = updates.deadline;
      else delete next.deadline;
    }
    if (updates.archived !== undefined) next.archived = updates.archived;
    return next;
  });
}

/** Remove a project from the list; returns true when something was removed. */
export function deleteProject(projects: Project[], id: string): Project[] {
  return projects.filter((p) => p.id !== id);
}

export function getProjectById(projects: Project[], id: string): Project | null {
  return projects.find((p) => p.id === id) || null;
}

/** Active (non-archived) projects, name-sorted. */
export function activeProjects(projects: Project[]): Project[] {
  return projects.filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name));
}

/** Archived projects, newest-updated first. */
export function archivedProjects(projects: Project[]): Project[] {
  return projects.filter((p) => p.archived).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Parse whitespace-separated tags from a raw string. */
export function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);
}

export function loadSelectedProject(projects: Project[]): string | null {
  const stored = read<string>(STORAGE_KEYS.selectedProject);
  if (!stored) return null;
  const active = activeProjects(projects);
  return active.some((p) => p.id === stored) ? stored : null;
}

export function saveSelectedProject(id: string | null): boolean {
  return write(STORAGE_KEYS.selectedProject, id);
}

/* ---------- project time stats ---------- */

export interface ProjectStats {
  minutes: number;
  sessions: number;
  /** Focus minutes per session on this project (for the report chart). */
  perDay: Array<{ day: string; min: number }>;
}

export function getMinutesForProject(
  projectId: string,
  history: Array<{ projectId?: string; min: number }>,
): number {
  return history.filter((s) => s.projectId === projectId).reduce((sum, s) => sum + s.min, 0);
}

export function getProjectStats(
  projectId: string,
  history: Array<{ projectId?: string; min: number; at: number }>,
): ProjectStats {
  const sessions = history.filter((s) => s.projectId === projectId);
  const minutes = sessions.reduce((sum, s) => sum + s.min, 0);
  const perDay = new Map<string, number>();
  for (const s of sessions) {
    const d = new Date(s.at);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    perDay.set(key, (perDay.get(key) || 0) + s.min);
  }
  return {
    minutes,
    sessions: sessions.length,
    perDay: [...perDay.entries()]
      .map(([day, min]) => ({ day, min }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export function formatProjectDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
