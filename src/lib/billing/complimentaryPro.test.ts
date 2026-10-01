import { describe, expect, it, beforeEach } from 'vitest';

import {
  fetchComplimentaryPro,
  loadComplimentaryCache,
  resolveIsPro,
  saveComplimentaryCache,
} from './complimentaryPro';
import {
  COMPLIMENTARY_PRO_EMAILS,
  hasComplimentaryPro,
  normalizeComplimentaryEmail,
  parseComplimentaryProEmails,
  resolveComplimentaryAllowlist,
} from '../../../cloudflare/workers/complimentaryPro';
import clientSource from './complimentaryPro.ts?raw';
import { handleEntitlement } from '../../../cloudflare/workers/entitlement';

describe('gifted Pro allowlist (Worker only)', () => {
  it('normalizes email case and whitespace', () => {
    expect(normalizeComplimentaryEmail('  Foo@Example.COM ')).toBe('foo@example.com');
  });

  it('parses comma / semicolon / whitespace env lists and drops junk', () => {
    expect(parseComplimentaryProEmails('a@x.com, B@Y.com;c@z.com  d@w.com')).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
      'd@w.com',
    ]);
    expect(parseComplimentaryProEmails('')).toEqual([]);
    expect(parseComplimentaryProEmails(null)).toEqual([]);
    expect(parseComplimentaryProEmails('a@x.com, a@x.com, A@X.com')).toEqual(['a@x.com']);
  });

  it('merges hardcoded + env without duplicates and matches case-insensitively', () => {
    const list = resolveComplimentaryAllowlist('b@y.com, a@x.com', ['A@X.com', 'c@z.com']);
    expect(list).toEqual(['a@x.com', 'c@z.com', 'b@y.com']);
    expect(hasComplimentaryPro('C@Z.com', list)).toBe(true);
    expect(hasComplimentaryPro('other@example.com', list)).toBe(false);
    expect(hasComplimentaryPro(null, list)).toBe(false);
    expect(COMPLIMENTARY_PRO_EMAILS.length).toBeGreaterThan(0);
  });

  it('never ships an email address in the client module', () => {
    expect(clientSource).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});

describe('GET /api/account/entitlement', () => {
  const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
  const auth = (email: string | null) =>
    (async () =>
      new Response(JSON.stringify({ id: 'user-1', email }), { status: 200 })) as typeof fetch;
  const req = (token?: string) =>
    new Request('https://moneo.bond/api/account/entitlement', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  it('answers a single boolean for the caller', async () => {
    const gifted = await handleEntitlement(
      req('t'),
      { ...env, PRO_COMPLIMENTARY_EMAILS: 'vip@example.com' },
      auth('VIP@example.com'),
    );
    expect(await gifted.json()).toEqual({ complimentary: true });
    const plain = await handleEntitlement(req('t'), env, auth('someone@example.com'));
    expect(await plain.json()).toEqual({ complimentary: false });
  });

  it('requires a session', async () => {
    expect((await handleEntitlement(req(), env, auth('a@b.co'))).status).toBe(401);
    const post = new Request('https://moneo.bond/api/account/entitlement', { method: 'POST' });
    expect((await handleEntitlement(post, env, auth('a@b.co'))).status).toBe(405);
  });
});

describe('gifted Pro on the client', () => {
  beforeEach(() => localStorage.clear());

  it('ORs paid access with the gift', () => {
    expect(resolveIsPro(true, false)).toBe(true);
    expect(resolveIsPro(false, true)).toBe(true);
    expect(resolveIsPro(false, false)).toBe(false);
  });

  it('remembers the last answer per user only', () => {
    saveComplimentaryCache('user-1', true);
    expect(loadComplimentaryCache('user-1')).toBe(true);
    expect(loadComplimentaryCache('user-2')).toBe(false);
    expect(loadComplimentaryCache(null)).toBe(false);
  });

  it('reads the Worker answer and treats failures as unknown', async () => {
    const ok = (async () =>
      new Response(JSON.stringify({ complimentary: true }), { status: 200 })) as typeof fetch;
    expect(await fetchComplimentaryPro(async () => 'tok', ok)).toBe(true);
    const down = (async () => new Response('', { status: 503 })) as typeof fetch;
    expect(await fetchComplimentaryPro(async () => 'tok', down)).toBeNull();
    expect(await fetchComplimentaryPro(async () => null, ok)).toBeNull();
  });
});
