/**
 * Free / libre AI path (Ollama or OpenAI-compatible local base).
 *
 * Fail-closed: missing/invalid env or unreachable host → {ok:false}.
 * Never hardcodes keys. Browser only talks to the URL the user set
 * (typically http://127.0.0.1:11434). No secrets in VITE_* beyond a
 * public base URL + model name.
 */
import { buildPath, resolveInput } from './planner';
import type { BuiltPath, PathInput } from './types';
import { LocalPlanner, type ProviderResult, type PlannerProvider } from './providers';

export function ollamaConfig(): { baseUrl: string; model: string } | null {
  const raw = (import.meta.env.VITE_AI_OLLAMA_URL as string | undefined)?.trim() ?? '';
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const model = (
    (import.meta.env.VITE_AI_OLLAMA_MODEL as string | undefined)?.trim() || 'llama3.2'
  ).slice(0, 80);
  return { baseUrl: url.origin + url.pathname.replace(/\/$/, ''), model };
}

export function isLibreAiConfigured(): boolean {
  return ollamaConfig() !== null;
}

async function chatCompletion(
  baseUrl: string,
  model: string,
  system: string,
  user: string,
  timeoutMs = 20_000,
): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Prefer OpenAI-compatible /v1/chat/completions (Ollama supports it).
    const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: false,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      message?: { content?: string };
    };
    const text = data?.choices?.[0]?.message?.content ?? data?.message?.content ?? '';
    return typeof text === 'string' && text.trim() ? text.trim().slice(0, 4000) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Planner that asks a local model, falls back closed (not to invent). */
export class OllamaPlanner implements PlannerProvider {
  readonly id = 'ollama' as const;

  async buildPath(input: PathInput): Promise<ProviderResult> {
    const cfg = ollamaConfig();
    if (!cfg) return { ok: false, reason: 'ollama-unconfigured' };
    const text = input.text?.trim() ?? '';
    if (!text) return { ok: false, reason: 'empty-goal' };

    const resolved = resolveInput(input);
    const system =
      'You are Moneo planning helper. Reply JSON only: ' +
      '{"tasks":[{"title":string,"pomodoros":number,"priority":"p1"|"p2"|"p3"}]}. ' +
      'Max 20 concrete next actions. No markdown.';
    const user = `Goal: ${resolved.text}\nHorizon months: ${resolved.horizonMonths}\nHours/week: ${resolved.hoursPerWeek}`;
    const raw = await chatCompletion(cfg.baseUrl, cfg.model, system, user);
    if (!raw) return { ok: false, reason: 'ollama-unreachable' };

    let parsed: { tasks?: Array<{ title?: string; pomodoros?: number; priority?: string }> };
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      parsed = JSON.parse(start >= 0 ? raw.slice(start, end + 1) : raw);
    } catch {
      // Model failed shape → fall back to deterministic local path (still useful).
      try {
        return { ok: true, path: buildPath(resolved) };
      } catch {
        return { ok: false, reason: 'ollama-bad-payload' };
      }
    }
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks
          .filter((t) => t && typeof t.title === 'string' && t.title.trim())
          .slice(0, 20)
          .map((t, i) => ({
            draftId: `ol-${i + 1}`,
            milestoneId: 'm1',
            title: String(t.title).trim().slice(0, 120),
            pomodoros: Math.min(8, Math.max(1, Math.round(Number(t.pomodoros) || 1))),
            priority: (t.priority === 'p1' || t.priority === 'p3' ? t.priority : 'p2') as
              'p1' | 'p2' | 'p3',
          }))
      : [];
    if (tasks.length === 0) {
      try {
        return { ok: true, path: buildPath(resolved) };
      } catch {
        return { ok: false, reason: 'ollama-empty' };
      }
    }
    const path: BuiltPath = {
      goal: resolved.text,
      kind: 'general',
      horizonMonths: resolved.horizonMonths,
      level: resolved.level,
      hoursPerWeek: resolved.hoursPerWeek,
      phases: [
        {
          id: 'p1',
          index: 1,
          months: [1, Math.min(3, resolved.horizonMonths)],
          outcome: resolved.text,
        },
      ],
      milestones: [{ id: 'm1', phaseId: 'p1', title: resolved.text }],
      tasks,
      totalPomodoros: tasks.reduce((n, t) => n + t.pomodoros, 0),
      fitsCapacity: true,
      assumptions: [],
    };
    return { ok: true, path };
  }
}

/**
 * Libre chat for the in-app assistant. Fail-closed → caller keeps rule-based reply.
 */
export async function libreAssist(
  prompt: string,
  contextBlurb: string,
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const cfg = ollamaConfig();
  if (!cfg) return { ok: false, reason: 'unconfigured' };
  const clean = prompt.trim().slice(0, 1500);
  if (!clean) return { ok: false, reason: 'empty' };
  const system =
    'You are Moneo, a calm focus & planning bot. Help with focus sessions, ' +
    'day/week plans and long horizons (1y-life). Be concise (max 120 words). ' +
    'Never invent private data. If unsure, suggest one concrete next step.';
  const user = contextBlurb ? `${contextBlurb}\n\nUser: ${clean}` : clean;
  const text = await chatCompletion(cfg.baseUrl, cfg.model, system, user, 18_000);
  if (!text) return { ok: false, reason: 'unreachable' };
  return { ok: true, text };
}

/** Prefer local libre model when configured; else on-device deterministic. */
export function resolveFreePlanner(): PlannerProvider {
  if (isLibreAiConfigured()) return new OllamaPlanner();
  return new LocalPlanner();
}
