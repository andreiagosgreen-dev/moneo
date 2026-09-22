import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseClient, getSupabaseConfig, normalizeSupabaseUrl } from './supabase';

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

  it('accepts new sb_publishable_ keys (opaque, not JWT)', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://yvkguiiqojwyosvkxzbt.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_example_key_value');
    expect(getSupabaseConfig()).toEqual({
      configured: true,
      url: 'https://yvkguiiqojwyosvkxzbt.supabase.co',
      anonKey: 'sb_publishable_example_key_value',
    });
  });

  it('accepts legacy JWT-shaped anon keys', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.signature';
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', jwt);
    expect(getSupabaseConfig()).toEqual({
      configured: true,
      url: 'https://example.supabase.co',
      anonKey: jwt,
    });
  });

  it('normalizes /rest/v1 paste leftovers on the project URL', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co/rest/v1/')).toBe(
      'https://example.supabase.co',
    );
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co/rest/v1');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_ok');
    expect(getSupabaseConfig()).toEqual({
      configured: true,
      url: 'https://example.supabase.co',
      anonKey: 'sb_publishable_ok',
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

  it('rejects .env.example placeholder paste leftovers', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://your-project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'your-anon-key-here');
    expect(getSupabaseConfig()).toEqual({ configured: false });
  });

  it('yields a null client without network when unconfigured', async () => {
    await expect(getSupabaseClient()).resolves.toBeNull();
  });
});
