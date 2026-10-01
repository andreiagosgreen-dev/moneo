import { describe, expect, it } from 'vitest';
import type { FetchImpl } from '../../../cloudflare/workers/account';
import { cleanSteps, dailyLimitOf, handleAIPlan, planPrompt } from '../../../cloudflare/workers/ai';
import { buildByokPath, hostedPlan } from './byok';

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

describe('included AI planner (client)', () => {
  const input = { text: 'Învăț React', horizonMonths: 6, hoursPerWeek: 5 };
  const local = { provider: 'local' as const, key: '', webSearch: false };

  it('builds the path from the Worker’s steps', async () => {
    const ok = (async () => new Response(MODEL, { status: 200 })) as unknown as typeof fetch;
    const r = await hostedPlan(input, async () => 'tok', ok);
    expect(r.ok).toBe(true);
    expect(r.used).toBe('moneo');
    expect(r.path?.tasks.map((t) => t.title)).toContain('Instalează Node');
  });

  it('falls back to the local planner quietly when the AI is not set up', async () => {
    const r = await buildByokPath(input, local, fetch, async () => ({
      ok: false,
      reason: 'moneo-http-501',
      used: 'moneo',
    }));
    expect(r.ok).toBe(true);
    expect(r.used).toBe('local');
  });

  it('says so when the daily allowance is used up', async () => {
    const r = await buildByokPath(input, local, fetch, async () => ({
      ok: false,
      reason: 'moneo-daily-limit',
      used: 'moneo',
    }));
    expect(r.used).toBe('local-fallback');
    expect(r.reason).toBe('moneo-daily-limit');
  });

  it('maps the Worker’s daily-limit answer', async () => {
    const limited = (async () =>
      new Response(JSON.stringify({ code: 'daily_limit' }), {
        status: 429,
      })) as unknown as typeof fetch;
    expect((await hostedPlan(input, async () => 'tok', limited)).reason).toBe('moneo-daily-limit');
  });
});
