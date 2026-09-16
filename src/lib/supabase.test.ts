import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseClient, getSupabaseConfig } from './supabase';

beforeEach(() => {
  vi.unstubAllEnvs();
  // Remove env vars that might be loaded from .env.local
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('supabase env contract', () => {
  it('reports unconfigured without throwing when env is absent', () => {
    expect(() => getSupabaseConfig()).not.toThrow();
    expect(getSupabaseConfig()).toEqual({ configured: false });
  });

  it('reports configured when valid publishable env is present', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-public-key');
    const cfg = getSupabaseConfig();
    expect(cfg).toEqual({
      configured: true,
      url: 'https://example.supabase.co',
      anonKey: 'anon-public-key',
    });
  });

  it('rejects malformed URLs and empty anon keys', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'not-a-url');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-public-key');
    expect(getSupabaseConfig()).toEqual({ configured: false });
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(getSupabaseConfig()).toEqual({ configured: false });
  });

  it('yields a null client without network when unconfigured', async () => {
    await expect(getSupabaseClient()).resolves.toBeNull();
  });
});
