import { describe, expect, it, vi } from 'vitest';
import type { FetchImpl } from '../../../cloudflare/workers/account';
import { cleanSteps, dailyLimitOf, handleAIPlan, planPrompt } from '../../../cloudflare/workers/ai';
import { buildByokPath } from './byok';

function req(body: string, ip: string): Request {
  const headers = new Map([
    ['authorization', 'Bearer good-token'],
    ['cf-connecting-ip', ip],
  ]);
  return {
    method: 'POST',
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    text: async () => body,
  } as unknown as Request;
}

/** Supabase (auth + active Pro row) and an OpenAI-compatible model answer. */
function backend(modelContent: string): FetchImpl {
  return (async (url: string) => {
    const u = String(url);
    if (u.includes('/chat/completions')) {
      return new Response(JSON.stringify({ choices: [{ message: { content: modelContent } }] }), {
        status: 200,
      });
    }
    const body = u.includes('/rest/v1/subscriptions')
      ? [{ status: 'active', current_period_end: null }]
      : { id: 'u-1', email: 'u1@example.com' };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as FetchImpl;
}

function memoryKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      store.set(k, v);
    },
  };
}

const ENV = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'srv',
  AI_API_KEY: 'model-key',
};
const BODY = JSON.stringify({ goal: 'Învăț React', horizonMonths: 6, hoursPerWeek: 5 });
const MODEL = JSON.stringify({
  steps: [
    { title: 'Instalează Node', estimateMin: 30 },
    { title: '', estimateMin: 10 },
    { title: 'Primul component', estimateMin: 9999 },
  ],
});

describe('included AI planner (Worker)', () => {
  it('returns clean steps from the model', async () => {
    const res = await handleAIPlan(req(BODY, 'h-1'), ENV, backend(MODEL));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      steps: [
        { title: 'Instalează Node', estimateMin: 30 },
        { title: 'Primul component', estimateMin: 600 },
      ],
    });
  });

  it('enforces the per-account daily allowance', async () => {
    const kv = memoryKv();
    const env = { ...ENV, KV_CACHE: kv, AI_DAILY_LIMIT: '2' };
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await handleAIPlan(req(BODY, `q-${i}`), env, backend(MODEL))).status);
    }
    expect(statuses).toEqual([200, 200, 429]);
    expect([...kv.store.values()]).toEqual(['2']);
  });

  it('asks for steps in the goal’s language with the shared prompt', () => {
    const p = planPrompt({ goal: 'Construiesc o dronă', horizonMonths: 3, hoursPerWeek: 4 });
    expect(p).toContain('same language as the goal');
    expect(p).toContain('hardware/build goal');
    expect(dailyLimitOf(undefined)).toBe(20);
    expect(dailyLimitOf('abc')).toBe(20);
    expect(cleanSteps({ tasks: [{ title: 'x', pomodoros: 2 }] })).toEqual([
      { title: 'x', estimateMin: 50 },
    ]);
  });
});

describe('AI planner without an own key', () => {
  const input = { text: 'Învăț React', horizonMonths: 6, hoursPerWeek: 5 };
  const local = { provider: 'local' as const, key: '', webSearch: false };

  it('builds the plan on the device and never calls a server', async () => {
    const fetchSpy = vi.fn(async () => new Response(MODEL, { status: 200 }));
    const r = await buildByokPath(input, local, fetchSpy as unknown as typeof fetch);
    expect(r.ok).toBe(true);
    expect(r.used).toBe('local');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
