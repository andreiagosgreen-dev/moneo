import { describe, expect, it } from 'vitest';
import { buildHealthBody, type HealthEnv } from '../../../cloudflare/workers/health';

describe('buildHealthBody', () => {
  it('reports each integration as configured or not, never leaking values', () => {
    const env: HealthEnv = {
      SUPABASE_URL: 'https://xyz.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'srv-key',
      AI_API_KEY: 'ai-key',
    };
    const body = buildHealthBody(env);
    expect(body).toEqual({
      ok: true,
      env: { supabase: true, lemonSqueezy: false, ai: true },
    });
    expect(JSON.stringify(body)).not.toContain('srv-key');
    expect(JSON.stringify(body)).not.toContain('ai-key');
  });

  it('is all-false on a bare env, never throws', () => {
    expect(buildHealthBody({})).toEqual({
      ok: true,
      env: { supabase: false, lemonSqueezy: false, ai: false },
    });
  });

  it('requires both Supabase vars together', () => {
    expect(buildHealthBody({ SUPABASE_URL: 'https://xyz.supabase.co' }).env.supabase).toBe(false);
  });
});
