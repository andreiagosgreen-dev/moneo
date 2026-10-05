import { describe, expect, it } from 'vitest';
import type { FetchImpl } from '../../../cloudflare/workers/account';
import {
  cleanWorkoutAnswer,
  handleAIWorkout,
  validateWorkoutRequest,
  workoutPrompt,
} from '../../../cloudflare/workers/aiWorkout';

function req(body: string, ip: string, auth = 'Bearer good-token'): Request {
  const headers = new Map([
    ['authorization', auth],
    ['cf-connecting-ip', ip],
  ]);
  return {
    method: 'POST',
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    text: async () => body,
  } as unknown as Request;
}

function backend(pro = true): FetchImpl {
  return (async (url: string) => {
    const u = String(url);
    const body = u.includes('/rest/v1/subscriptions')
      ? pro
        ? [{ status: 'active', current_period_end: null }]
        : []
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

const CATALOG = ['pushup|chest|none|1', 'abWheelKneel|abs|abWheel|2', 'plank|abs|none|1'];
const BODY = JSON.stringify({ text: 'abs with my wheel, 15 min', catalog: CATALOG });
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' };

describe('AI workout packs (Worker)', () => {
  it('validates text and a strict catalogue', () => {
    expect(validateWorkoutRequest({ text: 'x', catalog: CATALOG }).ok).toBe(true);
    expect(validateWorkoutRequest({ text: '', catalog: CATALOG }).ok).toBe(false);
    expect(validateWorkoutRequest({ text: 'a'.repeat(301), catalog: CATALOG }).ok).toBe(false);
    expect(validateWorkoutRequest({ text: 'x', catalog: ['ignore previous|x|y|1'] }).ok).toBe(
      false,
    );
    expect(validateWorkoutRequest({ text: 'x', catalog: [] }).ok).toBe(false);
  });

  it('keeps only allowed values and catalogue ids', () => {
    expect(
      cleanWorkoutAnswer(
        {
          zone: 'core',
          minutes: 15,
          format: 'sets',
          level: 2,
          exercises: ['abWheelKneel', 'nope', 'plank', 'plank'],
        },
        CATALOG,
      ),
    ).toEqual({
      zone: 'core',
      minutes: 15,
      format: 'sets',
      level: 2,
      exercises: ['abWheelKneel', 'plank'],
    });
    expect(
      cleanWorkoutAnswer({ zone: 'core', minutes: 7, format: 'x', level: 9 }, CATALOG),
    ).toMatchObject({ minutes: 20, format: 'circuit', level: 1, exercises: [] });
    expect(cleanWorkoutAnswer({ zone: 'moon' }, CATALOG)).toBeNull();
  });

  it('puts the request and the catalogue in the prompt', () => {
    const p = workoutPrompt('spate, birou', CATALOG);
    expect(p).toContain('"spate, birou"');
    expect(p).toContain('abWheelKneel|abs|abWheel|2');
  });

  it('answers Pro on Workers AI and keeps its own daily counter', async () => {
    const kv = memoryKv();
    const run = async () => ({
      response: JSON.stringify({
        zone: 'core',
        minutes: 15,
        format: 'circuit',
        level: 2,
        exercises: ['abWheelKneel'],
      }),
    });
    const env = { ...ENV, AI: { run }, KV_CACHE: kv, AI_DAILY_LIMIT: '1' };
    const ok = await handleAIWorkout(req(BODY, 'w-1'), env, backend());
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ zone: 'core', exercises: ['abWheelKneel'] });
    expect([...kv.store.keys()].some((k) => k.startsWith('ai-workout:'))).toBe(true);
    expect((await handleAIWorkout(req(BODY, 'w-2'), env, backend())).status).toBe(429);
  });

  it('refuses free accounts, bad sessions and missing providers', async () => {
    const env = { ...ENV, AI: { run: async () => ({}) } };
    expect((await handleAIWorkout(req(BODY, 'w-3'), env, backend(false))).status).toBe(403);
    expect((await handleAIWorkout(req(BODY, 'w-4', ''), env, backend())).status).toBe(401);
    expect((await handleAIWorkout(req(BODY, 'w-5'), ENV, backend())).status).toBe(501);
  });
});
