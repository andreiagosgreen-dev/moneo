/**
 * Planner providers (Faza 6) + AI consent (Faza 5A/6).
 *
 * - LocalPlanner: deterministic on-device engine. Needs no consent,
 *   sends nothing anywhere.
 * - WorkerPlanner: calls POST /api/ai/plan. The browser NEVER holds an
 *   API key; the model (if configured) is called server-side only.
 *   Unconfigured/offline/invalid → fail-closed {ok:false}.
 *
 * Consent: tapping "Build my path" is consent for that one call.
 * "Auto-prepare" (standing consent for daily drafts) is a separate
 * explicit toggle with a timestamp, revocable anytime. No bulk
 * create/move/delete ever happens without preview + approval.
 */

import { STORAGE_KEYS } from '../storage/storageKeys';
import { safeRead as read, safeWrite as write } from '../storage/storageAdapter';
import { buildPath, resolveInput } from './planner';
import type { BuiltPath, PathInput } from './types';

export interface ProviderResult {
  ok: boolean;
  path?: BuiltPath;
  reason?: string;
}

export interface PlannerProvider {
  readonly id: 'local' | 'worker';
  buildPath(input: PathInput): Promise<ProviderResult>;
}

export class LocalPlanner implements PlannerProvider {
  readonly id = 'local' as const;
  async buildPath(input: PathInput): Promise<ProviderResult> {
    const text = input.text?.trim() ?? '';
    if (!text) return { ok: false, reason: 'empty-goal' };
    try {
      return { ok: true, path: buildPath(resolveInput(input)) };
    } catch {
      return { ok: false, reason: 'build-failed' };
    }
  }
}

/** Minimal context sent to the server planner — goal text only, no sessions. */
export function sanitizePlanRequest(input: PathInput): {
  goal: string;
  horizonMonths: number;
  hoursPerWeek: number;
} {
  const resolved = resolveInput({ ...input, text: input.text ?? '' });
  return {
    goal: resolved.text.slice(0, 500),
    horizonMonths: resolved.horizonMonths,
    hoursPerWeek: resolved.hoursPerWeek,
  };
}

export class WorkerPlanner implements PlannerProvider {
  readonly id = 'worker' as const;
  constructor(
    private readonly endpoint: string = '/api/ai/plan',
    private readonly getToken: () => Promise<string | null> = async () => null,
  ) {}

  async buildPath(input: PathInput): Promise<ProviderResult> {
    try {
      const token = await this.getToken();
      if (!token) return { ok: false, reason: 'signed-out' };
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(sanitizePlanRequest(input)),
      });
      if (!res.ok) return { ok: false, reason: `http-${res.status}` };
      const data = (await res.json()) as { path?: BuiltPath };
      if (!data || !data.path || !Array.isArray(data.path.tasks)) {
        return { ok: false, reason: 'bad-payload' };
      }
      return { ok: true, path: data.path };
    } catch {
      return { ok: false, reason: 'offline' };
    }
  }
}

export interface AIConsent {
  autoPrepare: boolean;
  at: number;
}

export function loadAIConsent(): AIConsent {
  const stored = read<unknown>(STORAGE_KEYS.aiConsent);
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    const c = stored as Partial<AIConsent>;
    if (typeof c.autoPrepare === 'boolean') {
      return {
        autoPrepare: c.autoPrepare,
        at: typeof c.at === 'number' ? c.at : 0,
      };
    }
  }
  return { autoPrepare: false, at: 0 };
}

export function saveAIConsent(consent: AIConsent): boolean {
  return write(STORAGE_KEYS.aiConsent, consent);
}
