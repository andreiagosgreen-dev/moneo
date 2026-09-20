/**
 * Pomodoro estimate learner (Faza 6): estimates start rough, then adapt
 * to the user's real pace. Per-scope multipliers (task → project →
 * general) learned with an EWMA over actual/estimated ratios.
 *
 * Feedback is minimal by design: done / continue / blocked /
 * mis-estimated. Blocked never moves the multiplier (not an estimate
 * problem). Rest, days off and human capacity are respected — the
 * learner tunes numbers, never fills the day artificially.
 */

import { STORAGE_KEYS } from '../storage/storageKeys';
import { safeRead as read, safeWrite as write } from '../storage/storageAdapter';
import type { SessionFeedback } from './types';

export interface EstimateProfile {
  key: string;
  /** Actual/estimated pace: >1 means slower than estimated. */
  multiplier: number;
  samples: number;
  updatedAt: number;
}

export type EstimateProfiles = Record<string, EstimateProfile>;

const MIN_MULT = 0.5;
const MAX_MULT = 3;
const ALPHA = 0.3;

export function generalKey(): string {
  return 'general';
}

export function scopeKey(projectId?: string | null, taskId?: string | null): string {
  if (taskId) return `task:${taskId}`;
  if (projectId) return `project:${projectId}`;
  return generalKey();
}

function clampMult(m: number): number {
  if (!Number.isFinite(m)) return 1;
  return Math.min(MAX_MULT, Math.max(MIN_MULT, m));
}

/** Adjusted Pomodoro estimate for a base guess and an optional profile. */
export function adjustEstimate(basePomodoros: number, profile?: EstimateProfile): number {
  const base = Math.min(8, Math.max(1, Math.round(basePomodoros)));
  if (!profile) return base;
  return Math.min(8, Math.max(1, Math.round(base * clampMult(profile.multiplier))));
}

/**
 * Fold one session's feedback into the profiles map (immutable update).
 * estimated/actual are Pomodoro counts; ratio is clamped before blending.
 */
export function recordFeedback(
  profiles: EstimateProfiles,
  key: string,
  estimatedPomodoros: number,
  actualPomodoros: number,
  feedback: SessionFeedback,
  now: number = Date.now(),
): EstimateProfiles {
  if (feedback === 'blocked') return profiles;
  const prev: EstimateProfile = profiles[key] ?? {
    key,
    multiplier: 1,
    samples: 0,
    updatedAt: now,
  };
  let multiplier = prev.multiplier;
  if (feedback === 'misestimated') {
    multiplier = clampMult(prev.multiplier * 1.25);
  } else if (estimatedPomodoros > 0 && actualPomodoros >= 0) {
    const ratio = clampMult(actualPomodoros / estimatedPomodoros);
    multiplier = clampMult(prev.multiplier + (ratio - prev.multiplier) * ALPHA);
  }
  return {
    ...profiles,
    [key]: { key, multiplier, samples: prev.samples + 1, updatedAt: now },
  };
}

const profilesKey = STORAGE_KEYS.estimateProfiles;

export function loadEstimateProfiles(): EstimateProfiles {
  const stored = read<unknown>(profilesKey);
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
  const out: EstimateProfiles = {};
  for (const [key, v] of Object.entries(stored as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const p = v as Partial<EstimateProfile>;
    if (typeof p.multiplier !== 'number') continue;
    out[key] = {
      key,
      multiplier: clampMult(p.multiplier),
      samples: typeof p.samples === 'number' && p.samples >= 0 ? Math.floor(p.samples) : 0,
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
    };
  }
  return out;
}

export function saveEstimateProfiles(profiles: EstimateProfiles): boolean {
  return write(profilesKey, profiles);
}
