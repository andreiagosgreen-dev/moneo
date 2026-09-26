/**
 * Bring-your-own-key AI providers for the Assistant.
 * Keys live only in localStorage (never VITE_* / never git).
 * Gemini can use Google Search grounding; OpenAI/DeepSeek are chat/plan only.
 */
import { safeRead as read, safeWrite as write } from '../storage/storageAdapter';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { buildPath, resolveInput } from './planner';
import type { BuiltPath, PathInput } from './types';

export type ByokProvider = 'local' | 'gemini' | 'openai' | 'deepseek';

export const BYOK_PROVIDERS: ByokProvider[] = ['local', 'gemini', 'openai', 'deepseek'];

export interface ByokConfig {
  provider: ByokProvider;
  /** Raw API key for the selected cloud provider (empty for local). */
  key: string;
  /** Gemini-only: enable Google Search grounding. */
  webSearch: boolean;
}

const DEFAULT: ByokConfig = { provider: 'local', key: '', webSearch: true };

export function loadByokConfig(): ByokConfig {
  const stored = read<Partial<ByokConfig>>(STORAGE_KEYS.aiByok);
  if (!stored || typeof stored !== 'object') return { ...DEFAULT };
  const provider = BYOK_PROVIDERS.includes(stored.provider as ByokProvider)
    ? (stored.provider as ByokProvider)
    : 'local';
  const key = typeof stored.key === 'string' ? stored.key.trim() : '';
  const webSearch = stored.webSearch !== false;
  return { provider, key, webSearch };
}

export function saveByokConfig(cfg: ByokConfig): boolean {
  const provider = BYOK_PROVIDERS.includes(cfg.provider) ? cfg.provider : 'local';
  return write(STORAGE_KEYS.aiByok, {
    provider,
    key: provider === 'local' ? '' : cfg.key.trim().slice(0, 256),
    webSearch: cfg.webSearch !== false,
  });
}

export function clearByokKey(): boolean {
  const cur = loadByokConfig();
  return saveByokConfig({ ...cur, key: '', provider: 'local' });
}

export interface ByokPlanResult {
  ok: boolean;
  path?: BuiltPath;
  sources?: string[];
  reason?: string;
  /** Which engine actually produced the path. */
  used: ByokProvider | 'local-fallback';
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Normalize a loose model JSON blob into BuiltPath via local buildPath + overrides. */
export function pathFromModelJson(
  input: PathInput,
  json: Record<string, unknown> | null,
): { path: BuiltPath; sources: string[] } {
  const resolved = resolveInput(input);
  const base = buildPath(resolved);
  const sources: string[] = [];
  if (!json) return { path: base, sources };

  if (Array.isArray(json.sources)) {
    for (const s of json.sources) {
      if (typeof s === 'string' && /^https?:\/\//i.test(s) && sources.length < 12) {
        sources.push(s.slice(0, 500));
      }
    }
  }

  const steps = Array.isArray(json.steps)
    ? json.steps
    : Array.isArray(json.tasks)
      ? json.tasks
      : null;
  if (!steps || steps.length === 0) return { path: base, sources };

  const tasks = steps
    .map((s, i) => {
      if (!s || typeof s !== 'object') return null;
      const rec = s as Record<string, unknown>;
      const title =
        typeof rec.title === 'string'
          ? rec.title.trim().slice(0, 160)
          : typeof rec.name === 'string'
            ? rec.name.trim().slice(0, 160)
            : '';
      if (!title) return null;
      const minutes =
        typeof rec.estimateMin === 'number'
          ? rec.estimateMin
          : typeof rec.minutes === 'number'
            ? rec.minutes
            : typeof rec.pomodoros === 'number'
              ? rec.pomodoros * 25
              : 50;
      const pomodoros = Math.min(8, Math.max(1, Math.round(minutes / 25)));
      return {
        draftId: `draft-${i + 1}`,
        milestoneId: base.milestones[0]?.id ?? 'ms-1-1',
        title,
        pomodoros,
        priority: (i === 0 ? 'p1' : i < 3 ? 'p2' : 'p3') as 'p1' | 'p2' | 'p3',
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .slice(0, 20);

  if (tasks.length === 0) return { path: base, sources };

  const totalPomodoros = tasks.reduce((s, t) => s + t.pomodoros, 0);
  const weeks = Math.max(1, (resolved.horizonMonths * 365) / 12 / 7);
  const totalHours = (totalPomodoros * 25) / 60;
  return {
    path: {
      ...base,
      tasks,
      totalPomodoros,
      fitsCapacity: totalHours <= resolved.hoursPerWeek * weeks,
    },
    sources,
  };
}

const PLAN_PROMPT = (input: PathInput, web: boolean) => {
  const r = resolveInput(input);
  const buildHint =
    r.kind === 'build' || /drone|dronă|hardware|robot|diy|pcb/i.test(r.text)
      ? 'This is a hardware/build goal: include Spec, BOM/parts, assemble, integrate, bench/safety, maiden, iterate. Mention failsafe/safety where relevant.'
      : 'Prefer concrete executable steps over vague advice.';
  return [
    'You are a learning/project roadmap assistant for Moneo.',
    'Return ONLY a JSON object with this shape:',
    '{"steps":[{"title":"string","estimateMin":number}],"sources":["https://..."]}',
    'Max 12 steps. estimateMin is focused work minutes for that step.',
    buildHint,
    web
      ? 'Use current web knowledge; put citation URLs in sources when possible.'
      : 'No need for live URLs.',
    `Goal: ${r.text}`,
    `Horizon months: ${r.horizonMonths}`,
    `Hours per week available: ${r.hoursPerWeek}`,
    `Level: ${r.level}`,
    r.kind ? `Path kind: ${r.kind}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

async function geminiPlan(
  input: PathInput,
  key: string,
  webSearch: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<ByokPlanResult> {
  const model = 'gemini-2.0-flash';
  // Key in header only — never in the query string (Referer / logs / history).
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: PLAN_PROMPT(input, webSearch) }] }],
  };
  if (webSearch) body.tools = [{ google_search: {} }];
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, reason: `gemini-http-${res.status}`, used: 'gemini' };
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string } }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? '';
    const json = extractJsonObject(text);
    const { path, sources } = pathFromModelJson(input, json);
    const grounded =
      data.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((c) => c.web?.uri)
        .filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u)) ?? [];
    const merged = [...sources];
    for (const u of grounded) {
      if (!merged.includes(u) && merged.length < 12) merged.push(u.slice(0, 500));
    }
    return { ok: true, path, sources: merged, used: 'gemini' };
  } catch {
    return { ok: false, reason: 'gemini-network', used: 'gemini' };
  }
}

async function openAiCompatiblePlan(
  input: PathInput,
  key: string,
  baseUrl: string,
  model: string,
  used: 'openai' | 'deepseek',
  fetchImpl: typeof fetch = fetch,
): Promise<ByokPlanResult> {
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'Return only valid JSON. No markdown outside JSON.' },
          { role: 'user', content: PLAN_PROMPT(input, false) },
        ],
      }),
    });
    if (!res.ok) return { ok: false, reason: `${used}-http-${res.status}`, used };
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? '';
    const { path, sources } = pathFromModelJson(input, extractJsonObject(text));
    return { ok: true, path, sources, used };
  } catch {
    return { ok: false, reason: `${used}-network`, used };
  }
}

/**
 * Build a path with the configured BYOK provider; on failure fall back to local.
 */
export async function buildByokPath(
  input: PathInput,
  cfg: ByokConfig = loadByokConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<ByokPlanResult> {
  const text = input.text?.trim() ?? '';
  if (!text) return { ok: false, reason: 'empty-goal', used: 'local' };

  if (cfg.provider === 'local' || !cfg.key) {
    try {
      return { ok: true, path: buildPath(resolveInput(input)), used: 'local' };
    } catch {
      return { ok: false, reason: 'build-failed', used: 'local' };
    }
  }

  let remote: ByokPlanResult;
  if (cfg.provider === 'gemini') {
    remote = await geminiPlan(input, cfg.key, cfg.webSearch, fetchImpl);
  } else if (cfg.provider === 'openai') {
    remote = await openAiCompatiblePlan(
      input,
      cfg.key,
      'https://api.openai.com/v1',
      'gpt-4o-mini',
      'openai',
      fetchImpl,
    );
  } else {
    remote = await openAiCompatiblePlan(
      input,
      cfg.key,
      'https://api.deepseek.com/v1',
      'deepseek-chat',
      'deepseek',
      fetchImpl,
    );
  }

  if (remote.ok && remote.path) return remote;

  try {
    return {
      ok: true,
      path: buildPath(resolveInput(input)),
      used: 'local-fallback',
      reason: remote.reason,
    };
  } catch {
    return { ok: false, reason: remote.reason ?? 'build-failed', used: remote.used };
  }
}
