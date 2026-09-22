import { describe, expect, it, vi } from 'vitest';
import {
  createAuthController,
  mapAuthError,
  type AuthClientLike,
  type AuthControllerDeps,
} from './authController';

interface RawUser {
  id: string;
  email?: string | null;
}

/** Controllable fake of the Supabase auth surface. */
function fakeClient(opts?: {
  sessionUser?: RawUser | null;
  accessToken?: string;
  signInError?: string;
  signUpError?: string;
  signUpNoSession?: boolean;
}) {
  const listeners: Array<(event: string, session: { user: RawUser } | null) => void> = [];
  let unsubscribed = false;
  const client: AuthClientLike = {
    getSession: async () => ({
      data: {
        session: opts?.sessionUser
          ? {
              user: opts.sessionUser,
              ...(opts?.accessToken ? { access_token: opts.accessToken } : {}),
            }
          : null,
      },
    }),
    onAuthStateChange: (cb) => {
      listeners.push(cb);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              unsubscribed = true;
            },
          },
        },
      };
    },
    signInWithPassword: async () =>
      opts?.signInError
        ? { data: { user: null }, error: { message: opts.signInError } }
        : {
            data: { user: { id: 'u-1', email: 'a@example.com' } },
            error: null,
          },
    signUp: async () =>
      opts?.signUpError
        ? {
            data: { user: null, session: null },
            error: { message: opts.signUpError },
          }
        : opts?.signUpNoSession
          ? {
              data: { user: { id: 'u-2', email: 'b@example.com' }, session: null },
              error: null,
            }
          : {
              data: {
                user: { id: 'u-2', email: 'b@example.com' },
                session: { user: { id: 'u-2', email: 'b@example.com' } },
              },
              error: null,
            },
    signInWithOAuth: async () => ({ data: { url: 'https://example.com/oauth' }, error: null }),
    signOut: async () => ({ error: null }),
  };
  return {
    client,
    listeners,
    fire: (event: string, session: { user: RawUser } | null) =>
      listeners.forEach((l) => l(event, session)),
    wasUnsubscribed: () => unsubscribed,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function deps(
  client: AuthClientLike | null,
  overrides?: Partial<AuthControllerDeps>,
): AuthControllerDeps & {
  ensureCalls: Array<{ userId: string; timezone: string }>;
  requestCalls: string[];
  cleared: { count: number };
} {
  const ensureCalls: Array<{ userId: string; timezone: string }> = [];
  const requestCalls: string[] = [];
  const cleared = { count: 0 };
  return {
    clientFactory: async () => client,
    ensureProfile: async (userId, timezone) => {
      ensureCalls.push({ userId, timezone });
      return true;
    },
    getProfileTimezone: async () => null,
    requestAccountDeletion: async (token: string) => {
      requestCalls.push(token);
      return true;
    },
    clearLocalData: () => {
      cleared.count += 1;
    },
    browserTimezone: () => 'Europe/Chisinau',
    ensureCalls,
    requestCalls,
    cleared,
    ...overrides,
  } as AuthControllerDeps & {
    ensureCalls: Array<{ userId: string; timezone: string }>;
    requestCalls: string[];
    cleared: { count: number };
  };
}

describe('auth state machine', () => {
  it('unconfigured Supabase resolves to anonymous without client calls', async () => {
    const factory = vi.fn(async () => null);
    const d = deps(null);
    d.clientFactory = factory;
    const c = createAuthController(d);
    c.init();
    await flush();
    expect(c.getSnapshot()).toEqual({
      status: 'anonymous',
      user: null,
      timezone: 'Europe/Chisinau',
    });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('loading → anonymous when the provider has no session', async () => {
    const { client } = fakeClient({ sessionUser: null });
    const c = createAuthController(deps(client));
    expect(c.getSnapshot().status).toBe('loading');
    c.init();
    await flush();
    expect(c.getSnapshot().status).toBe('anonymous');
  });

  it('loading → anonymous when getSession hangs past the boot deadline', async () => {
    vi.useFakeTimers();
    const hanging: AuthClientLike = {
      getSession: () => new Promise(() => {}),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ data: { user: null }, error: null }),
      signUp: async () => ({ data: { user: null, session: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithOAuth: async () => ({ data: {}, error: null }),
    };
    const c = createAuthController(deps(hanging));
    c.init();
    expect(c.getSnapshot().status).toBe('loading');
    await vi.advanceTimersByTimeAsync(4_000);
    expect(c.getSnapshot().status).toBe('anonymous');
    vi.useRealTimers();
  });

  it('StrictMode remount (dispose then init) still settles to anonymous', async () => {
    const { client } = fakeClient({ sessionUser: null });
    const c = createAuthController(deps(client));
    c.init();
    c.dispose();
    c.init();
    await flush();
    expect(c.getSnapshot().status).toBe('anonymous');
  });

  it('loading → authenticated exposes only userId and email', async () => {
    // Simulates a raw provider payload carrying fields Moneo must never surface.
    const rawWireUser = {
      id: 'u-1',
      email: 'a@example.com',
      phone: '+1234567890',
      user_metadata: { secret: 'x' },
      aud: 'authenticated',
    };
    const { client } = fakeClient({
      sessionUser: rawWireUser as unknown as RawUser,
    });
    const c = createAuthController(deps(client));
    c.init();
    await flush();
    const snap = c.getSnapshot();
    expect(snap.status).toBe('authenticated');
    expect(snap.user).toEqual({ userId: 'u-1', email: 'a@example.com' });
    expect(JSON.stringify(snap.user)).not.toContain('phone');
    expect(JSON.stringify(snap.user)).not.toContain('user_metadata');
  });

  it('auth loading never blocks: snapshot is readable before init settles', () => {
    const { client } = fakeClient({ sessionUser: null });
    const c = createAuthController(deps(client));
    const snap = c.getSnapshot();
    expect(snap.status).toBe('loading');
    expect(snap.timezone).toBe('Europe/Chisinau');
  });

  it('dispose unsubscribes the auth listener (no leaks)', async () => {
    const fake = fakeClient({ sessionUser: null });
    const c = createAuthController(deps(fake.client));
    c.init();
    await flush();
    expect(fake.listeners.length).toBe(1);
    c.dispose();
    expect(fake.wasUnsubscribed()).toBe(true);
  });

  it('an auth state change to SIGNED_IN authenticates and ensures the profile once', async () => {
    const fake = fakeClient({ sessionUser: null });
    const d = deps(fake.client);
    const c = createAuthController(d);
    c.init();
    await flush();
    expect(c.getSnapshot().status).toBe('anonymous');

    fake.fire('SIGNED_IN', { user: { id: 'u-9', email: 'nine@example.com' } });
    await flush();
    expect(c.getSnapshot().status).toBe('authenticated');
    expect(d.ensureCalls).toEqual([{ userId: 'u-9', timezone: 'Europe/Chisinau' }]);

    // A second event for the same user must NOT re-ensure the profile.
    fake.fire('TOKEN_REFRESHED', { user: { id: 'u-9', email: 'nine@example.com' } });
    await flush();
    expect(d.ensureCalls).toHaveLength(1);
  });
});

describe('sign-in / sign-up / sign-out', () => {
  it('sign-in success authenticates', async () => {
    const { client } = fakeClient();
    const c = createAuthController(deps(client));
    const res = await c.signIn('a@example.com', 'password123');
    expect(res).toEqual({ ok: true });
    expect(c.getSnapshot().status).toBe('authenticated');
    expect(c.getSnapshot().user?.userId).toBe('u-1');
  });

  it('sign-in maps invalid credentials to a calm message', async () => {
    const { client } = fakeClient({
      signInError: 'Invalid login credentials',
    });
    const c = createAuthController(deps(client));
    const res = await c.signIn('a@example.com', 'wrong');
    expect(res).toEqual({ ok: false, message: 'Incorrect email or password.' });
    expect(c.getSnapshot().status).toBe('loading'); // never authenticated
  });

  it('sign-in maps network failure and the app stays usable', async () => {
    const d = deps(null);
    d.clientFactory = async () => {
      throw new Error('Failed to fetch');
    };
    const c = createAuthController(d);
    const res = await c.signIn('a@example.com', 'password123');
    expect(res).toEqual({
      ok: false,
      message: 'Network unavailable — Moneo keeps working offline.',
    });
    // Local product unaffected: state machine still functional.
    expect(c.getSnapshot().status).toBe('loading');
  });

  it('sign-up success authenticates; confirmation flows return a note', async () => {
    const ok = fakeClient();
    const c1 = createAuthController(deps(ok.client));
    expect(await c1.signUp('b@example.com', 'password123')).toEqual({
      ok: true,
    });

    const pending = fakeClient({ signUpNoSession: true });
    const c2 = createAuthController(deps(pending.client));
    expect(await c2.signUp('b@example.com', 'password123')).toEqual({
      ok: true,
      note: 'Account created — check your inbox to confirm your email.',
    });
    expect(c2.getSnapshot().status).toBe('loading');
  });

  it('sign-out returns to anonymous', async () => {
    const { client } = fakeClient({
      sessionUser: { id: 'u-1', email: 'a@example.com' },
    });
    const c = createAuthController(deps(client));
    c.init();
    await flush();
    expect(c.getSnapshot().status).toBe('authenticated');
    await c.signOut();
    expect(c.getSnapshot().status).toBe('anonymous');
    expect(c.getSnapshot().user).toBeNull();
  });
});

describe('timezone policy', () => {
  it('prefers a valid stored profile timezone', async () => {
    const { client } = fakeClient({
      sessionUser: { id: 'u-1', email: 'a@example.com' },
    });
    const d = deps(client, {
      getProfileTimezone: async () => 'America/New_York',
    });
    const c = createAuthController(d);
    c.init();
    await flush();
    expect(c.getSnapshot().timezone).toBe('America/New_York');
  });

  it('falls back to the browser timezone when the stored value is invalid', async () => {
    const { client } = fakeClient({
      sessionUser: { id: 'u-1', email: 'a@example.com' },
    });
    const d = deps(client, {
      getProfileTimezone: async () => 'Mars/Olympus',
    });
    const c = createAuthController(d);
    c.init();
    await flush();
    expect(c.getSnapshot().timezone).toBe('Europe/Chisinau');
  });
});

describe('privacy: auth is not migration', () => {
  it('authenticating never uploads sessions — the controller has no upload path', async () => {
    const { client } = fakeClient({
      sessionUser: { id: 'u-1', email: 'a@example.com' },
    });
    const d = deps(client);
    const c = createAuthController(d);
    c.init();
    await flush();
    expect(c.getSnapshot().status).toBe('authenticated');
    // The controller API surface has no history/session upload method.
    expect(Object.keys(c).some((k) => /upload|sync|push/i.test(k))).toBe(false);
    // Only the profile bootstrap is allowed to touch the cloud.
    expect(d.ensureCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('covers existing email, weak password, and unknown errors', () => {
    expect(mapAuthError('User already registered')).toContain('sign in instead');
    expect(mapAuthError('Password should be at least 8 characters')).toContain('too weak');
    expect(mapAuthError('Something exploded #42')).toBe('Something went wrong. Please try again.');
    expect(mapAuthError(null)).toBe('Something went wrong. Please try again.');
  });
});

describe('deleteAccount (server-confirmed wipe)', () => {
  function signedIn(
    clientOpts?: Parameters<typeof fakeClient>[0],
    depOverrides?: Partial<AuthControllerDeps>,
  ) {
    const fake = fakeClient({
      sessionUser: { id: 'u-1', email: 'a@example.com' },
      accessToken: 'tok-abc',
      ...clientOpts,
    });
    const d = deps(fake.client, depOverrides);
    const c = createAuthController(d);
    c.init();
    return { c, d, fake };
  }

  it('wipes server-side, then clears local data and signs out', async () => {
    const { c, d, fake } = signedIn();
    await flush();
    expect(c.getSnapshot().status).toBe('authenticated');

    const signOutSpy = vi.fn(async () => ({ error: null }));
    fake.client.signOut = signOutSpy;

    const res = await c.deleteAccount();
    expect(res).toEqual({ ok: true });
    // Server got the raw access token (identity derived server-side).
    expect(d.requestCalls).toEqual(['tok-abc']);
    // Local wipe happens exactly once, only after server success…
    expect(d.cleared.count).toBe(1);
    // …then sign-out and anonymous state.
    expect(signOutSpy).toHaveBeenCalledTimes(1);
    expect(c.getSnapshot()).toEqual({
      status: 'anonymous',
      user: null,
      timezone: 'Europe/Chisinau',
    });
  });

  it('keeps everything local when the server wipe fails', async () => {
    const { c, d, fake } = signedIn({}, { requestAccountDeletion: async () => false });
    await flush();

    const signOutSpy = vi.fn(async () => ({ error: null }));
    fake.client.signOut = signOutSpy;

    const res = await c.deleteAccount();
    expect(res.ok).toBe(false);
    // Still signed in, nothing cleared, no sign-out attempted.
    expect(c.getSnapshot().status).toBe('authenticated');
    expect(c.getSnapshot().user?.userId).toBe('u-1');
    expect(d.cleared.count).toBe(0);
    expect(signOutSpy).not.toHaveBeenCalled();
  });

  it('keeps everything local when the endpoint throws', async () => {
    const { c, d } = signedIn(
      {},
      {
        requestAccountDeletion: async () => {
          throw new Error('boom');
        },
      },
    );
    await flush();
    const res = await c.deleteAccount();
    expect(res.ok).toBe(false);
    expect(c.getSnapshot().status).toBe('authenticated');
    expect(d.cleared.count).toBe(0);
  });

  it('refuses without a fresh access token', async () => {
    const { c, d } = signedIn({ accessToken: undefined });
    await flush();
    const res = await c.deleteAccount();
    expect(res.ok).toBe(false);
    expect(d.requestCalls).toHaveLength(0);
    expect(d.cleared.count).toBe(0);
    expect(c.getSnapshot().status).toBe('authenticated');
  });

  it('refuses when not signed in', async () => {
    const { client } = fakeClient({ sessionUser: null });
    const d = deps(client);
    const c = createAuthController(d);
    c.init();
    await flush();
    const res = await c.deleteAccount();
    expect(res.ok).toBe(false);
    expect(d.requestCalls).toHaveLength(0);
    expect(d.cleared.count).toBe(0);
  });
});

describe('captcha token forwarding (Faza 32a)', () => {
  function captchaSpyClient(): { client: AuthClientLike; calls: unknown[] } {
    const calls: unknown[] = [];
    const client: AuthClientLike = {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async (creds) => {
        calls.push(creds);
        return { data: { user: { id: 'u-1', email: 'a@example.com' } }, error: null };
      },
      signUp: async (creds) => {
        calls.push(creds);
        return {
          data: { user: { id: 'u-2', email: 'b@example.com' }, session: null },
          error: null,
        };
      },
      signOut: async () => ({ error: null }),
      signInWithOAuth: async () => ({ data: { url: null }, error: null }),
    };
    return { client, calls };
  }

  it('forwards captchaToken to signInWithPassword when provided', async () => {
    const { client, calls } = captchaSpyClient();
    const c = createAuthController(deps(client));
    await c.signIn('a@example.com', 'password123', 'tok-abc');
    expect(calls[0]).toMatchObject({ options: { captchaToken: 'tok-abc' } });
  });

  it('omits options entirely when no captchaToken is given', async () => {
    const { client, calls } = captchaSpyClient();
    const c = createAuthController(deps(client));
    await c.signIn('a@example.com', 'password123');
    expect(calls[0]).not.toHaveProperty('options');
  });

  it('forwards captchaToken to signUp when provided', async () => {
    const { client, calls } = captchaSpyClient();
    const c = createAuthController(deps(client));
    await c.signUp('b@example.com', 'password123', 'tok-xyz');
    expect(calls[0]).toMatchObject({ options: { captchaToken: 'tok-xyz' } });
  });
});
