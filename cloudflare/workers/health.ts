/**
 * Presence-only /api/health payload. Never throws, never leaks secret values.
 */

export interface HealthEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LEMON_SQUEEZY_WEBHOOK_SECRET?: string;
  AI_API_KEY?: string;
}

export function buildHealthBody(env: HealthEnv): {
  ok: true;
  env: { supabase: boolean; lemonSqueezy: boolean; ai: boolean };
} {
  return {
    ok: true,
    env: {
      supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
      lemonSqueezy: Boolean(env.LEMON_SQUEEZY_WEBHOOK_SECRET),
      ai: Boolean(env.AI_API_KEY),
    },
  };
}
