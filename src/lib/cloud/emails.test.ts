import { describe, expect, it, vi } from 'vitest';
import {
  EMAIL_LANGS,
  MAX_REMINDERS_PER_RUN,
  forgetEmailMarkers,
  handleUnsubscribe,
  handleWelcome,
  needsReminder,
  pickLang,
  renderEmail,
  runReminders,
  unsubToken,
  type EmailEnv,
} from '../../../cloudflare/workers/emails';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-02T09:00:00Z');
const SECRET = 'service-role-secret';

function memoryKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      store.set(k, v);
    },
    delete: async (k: string) => {
      store.delete(k);
    },
  };
}

function env(over: Partial<EmailEnv> = {}): EmailEnv & { KV_CACHE: ReturnType<typeof memoryKv> } {
  return {
    SUPABASE_URL: 'https://db.example',
    SUPABASE_SERVICE_ROLE_KEY: SECRET,
    RESEND_API_KEY: 're_test',
    KV_CACHE: memoryKv(),
    ...over,
  } as EmailEnv & { KV_CACHE: ReturnType<typeof memoryKv> };
}

const iso = (ms: number) => new Date(ms).toISOString();

describe('pickLang', () => {
  it('prefers the app language, then the time zone, else English', () => {
    expect(pickLang('ro-RO')).toBe('ro');
    expect(pickLang('xx', 'Europe/Chisinau')).toBe('ro');
    expect(pickLang('', 'Europe/Kyiv')).toBe('uk');
    expect(pickLang(null, 'America/New_York')).toBe('en');
  });
});

describe('renderEmail', () => {
  it('has a subject, the app link and the unsubscribe link in every language', () => {
    for (const lang of EMAIL_LANGS) {
      for (const kind of ['welcome', 'reminder'] as const) {
        const m = renderEmail(kind, lang, 'https://moneo.bond/api/email/unsubscribe?u=a&s=b');
        expect(m.subject.length, `${lang}/${kind}`).toBeGreaterThan(3);
        expect(m.html).toContain('href="https://moneo.bond/"');
        expect(m.html).toContain('unsubscribe?u=a&amp;s=b');
        expect(m.text).toContain('unsubscribe?u=a&s=b');
        expect(m.html).not.toMatch(/<script/i);
      }
    }
  });
});

describe('unsubscribe', () => {
  it('signs per user and only accepts the right signature', async () => {
    const a = await unsubToken('user-a', SECRET);
    expect(a).toHaveLength(32);
    expect(await unsubToken('user-a', SECRET)).toBe(a);
    expect(await unsubToken('user-b', SECRET)).not.toBe(a);

    const e = env();
    const bad = await handleUnsubscribe(
      new Request(`https://moneo.bond/api/email/unsubscribe?u=user-a&s=${'0'.repeat(32)}`),
      e,
    );
    expect(bad.status).toBe(400);
    expect(e.KV_CACHE.store.has('mail:unsub:user-a')).toBe(false);

    const ok = await handleUnsubscribe(
      new Request(`https://moneo.bond/api/email/unsubscribe?u=user-a&s=${a}`, { method: 'POST' }),
      e,
    );
    expect(ok.status).toBe(200);
    expect(e.KV_CACHE.store.has('mail:unsub:user-a')).toBe(true);
  });
});

function welcomeFetch(createdAt: string, sent: Array<Record<string, unknown>>) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith('/auth/v1/user')) {
      return new Response(
        JSON.stringify({ id: 'u1', email: 'new@example.com', created_at: createdAt }),
        { status: 200 },
      );
    }
    if (u === 'https://api.resend.com/emails') {
      sent.push(JSON.parse(String(init?.body)));
      return new Response('{"id":"e1"}', { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}

const welcomeRequest = (locale = 'ro') =>
  new Request('https://moneo.bond/api/email/welcome', {
    method: 'POST',
    headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale }),
  });

describe('handleWelcome', () => {
  it('needs a session', async () => {
    const res = await handleWelcome(
      new Request('https://moneo.bond/api/email/welcome', { method: 'POST' }),
      env(),
    );
    expect(res.status).toBe(401);
  });

  it('sends once, in the app language, with an unsubscribe header', async () => {
    const e = env();
    const sent: Array<Record<string, unknown>> = [];
    const f = welcomeFetch(iso(NOW - DAY), sent);
    const first = await (await handleWelcome(welcomeRequest(), e, f, NOW)).json();
    const second = await (await handleWelcome(welcomeRequest(), e, f, NOW)).json();
    expect(first).toEqual({ sent: true });
    expect(second).toEqual({ sent: false, reason: 'already_sent' });
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('Bun venit în Moneo');
    expect(sent[0].to).toEqual(['new@example.com']);
    expect((sent[0].headers as Record<string, string>)['List-Unsubscribe-Post']).toBe(
      'List-Unsubscribe=One-Click',
    );
    expect(e.KV_CACHE.store.get('mail:lang:u1')).toBe('ro');
  });

  it('skips accounts older than a week and works as a no-op without Resend', async () => {
    const sent: Array<Record<string, unknown>> = [];
    const old = await (
      await handleWelcome(welcomeRequest(), env(), welcomeFetch(iso(NOW - 30 * DAY), sent), NOW)
    ).json();
    expect(old).toEqual({ sent: false, reason: 'not_new' });

    const e = env({ RESEND_API_KEY: undefined });
    const off = await (
      await handleWelcome(welcomeRequest('de'), e, welcomeFetch(iso(NOW), sent), NOW)
    ).json();
    expect(off).toEqual({ sent: false, reason: 'not_configured' });
    expect(e.KV_CACHE.store.get('mail:lang:u1')).toBe('de');
    expect(sent).toHaveLength(0);
  });
});

describe('sign-up counter', () => {
  const req = (body: Record<string, unknown>) =>
    new Request('https://moneo.bond/api/email/welcome', {
      method: 'POST',
      headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('counts a new account once, with its channel', async () => {
    const writeDataPoint = vi.fn();
    const e = { ...env(), EVENTS: { writeDataPoint } };
    const f = welcomeFetch(iso(NOW - 3_600_000), []);
    await handleWelcome(req({ locale: 'ro', s: 'tiktok', c: 'exam' }), e, f, NOW);
    await handleWelcome(req({ locale: 'ro', s: 'tiktok' }), e, f, NOW);
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    expect(writeDataPoint.mock.calls[0][0]).toMatchObject({
      blobs: ['sign_up', '', 'ro', 'tiktok', 'exam', ''],
    });
  });

  it('skips old accounts and browsers that opted out', async () => {
    const writeDataPoint = vi.fn();
    await handleWelcome(
      req({ locale: 'en', count: false }),
      { ...env(), EVENTS: { writeDataPoint } },
      welcomeFetch(iso(NOW - 3_600_000), []),
      NOW,
    );
    await handleWelcome(
      req({ locale: 'en', s: 'reddit' }),
      { ...env(), EVENTS: { writeDataPoint } },
      welcomeFetch(iso(NOW - 5 * DAY), []),
      NOW,
    );
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});

describe('needsReminder', () => {
  const base = {
    id: 'q',
    email: 'q@example.com',
    email_confirmed_at: iso(NOW - 20 * DAY),
    created_at: iso(NOW - 20 * DAY),
    last_sign_in_at: iso(NOW - 15 * DAY),
  };
  it('reminds quiet, confirmed accounts aged 7–60 days only', () => {
    expect(needsReminder(base, new Set(), NOW)).toBe(true);
    expect(needsReminder(base, new Set(['q']), NOW)).toBe(false);
    expect(needsReminder({ ...base, last_sign_in_at: iso(NOW - DAY) }, new Set(), NOW)).toBe(false);
    expect(needsReminder({ ...base, created_at: iso(NOW - 2 * DAY) }, new Set(), NOW)).toBe(false);
    expect(needsReminder({ ...base, created_at: iso(NOW - 90 * DAY) }, new Set(), NOW)).toBe(false);
    expect(needsReminder({ ...base, email_confirmed_at: null }, new Set(), NOW)).toBe(false);
  });
});

describe('runReminders', () => {
  function cronFetch(users: unknown[], activeIds: string[], sent: string[]) {
    return (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/rest/v1/focus_sessions')) {
        return new Response(JSON.stringify(activeIds.map((user_id) => ({ user_id }))), {
          status: 200,
        });
      }
      if (u.includes('/auth/v1/admin/users')) {
        return new Response(JSON.stringify({ users }), { status: 200 });
      }
      if (u === 'https://api.resend.com/emails') {
        sent.push((JSON.parse(String(init?.body)) as { to: string[] }).to[0]);
        return new Response('{}', { status: 200 });
      }
      return new Response('', { status: 404 });
    }) as typeof fetch;
  }
  const quiet = (id: string) => ({
    id,
    email: `${id}@example.com`,
    email_confirmed_at: iso(NOW - 20 * DAY),
    created_at: iso(NOW - 20 * DAY),
    last_sign_in_at: iso(NOW - 15 * DAY),
  });

  it('reminds each quiet account once, skipping active and unsubscribed ones', async () => {
    const e = env();
    await e.KV_CACHE.put('mail:unsub:c', '1');
    const sent: string[] = [];
    const f = cronFetch([quiet('a'), quiet('b'), quiet('c')], ['b'], sent);
    expect(await runReminders(e, f, NOW)).toEqual({ sent: 1 });
    expect(sent).toEqual(['a@example.com']);
    expect(await runReminders(e, f, NOW)).toEqual({ sent: 0 });
  });

  it('caps a run and does nothing without Resend', async () => {
    const many = Array.from({ length: MAX_REMINDERS_PER_RUN + 10 }, (_, i) => quiet(`u${i}`));
    const sent: string[] = [];
    expect(await runReminders(env(), cronFetch(many, [], sent), NOW)).toEqual({
      sent: MAX_REMINDERS_PER_RUN,
    });
    expect(
      await runReminders(env({ RESEND_API_KEY: undefined }), cronFetch(many, [], []), NOW),
    ).toEqual({
      sent: 0,
      skipped: 'not_configured',
    });
  });

  it('sends nothing when activity cannot be read', async () => {
    const f = (async () => new Response('boom', { status: 500 })) as typeof fetch;
    await expect(runReminders(env(), f, NOW)).rejects.toThrow();
  });
});

describe('forgetEmailMarkers', () => {
  it('drops every marker of the deleted account', async () => {
    const kv = memoryKv();
    for (const k of ['welcome', 'reminder', 'unsub', 'lang', 'seen'])
      await kv.put(`mail:${k}:z`, '1');
    await kv.put('mail:welcome:other', '1');
    await forgetEmailMarkers(kv, 'z');
    expect([...kv.store.keys()]).toEqual(['mail:welcome:other']);
  });
});
