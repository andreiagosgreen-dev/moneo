import { isValidIanaTimezone } from './timezone';

/**
 * Moneo auth state machine — framework-free so it is fully testable.
 * The React layer (authProvider.tsx) is a thin subscription wrapper.
 *
 * States: loading → anonymous | authenticated.
 * - Unconfigured Supabase (missing env) resolves straight to anonymous
 *   with ZERO network activity — local product unchanged.
 * - Any auth/network failure degrades to anonymous; the timer never blocks.
 * - Only minimal identity leaves this module: { userId, email }.
 * - Authentication bootstraps the profile (idempotent, once per user).
 *   It NEVER uploads sessions, areas or settings — that is the explicit,
 *   user-consented sync flow. auth ≠ migration.
 */

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export interface AuthIdentity {
  userId: string;
  email: string | null;
}

export interface AuthSnapshot {
  status: AuthStatus;
  user: AuthIdentity | null;
  /** Effective IANA timezone: profile value when valid, else browser. */
  timezone: string;
}

export type AuthResult = { ok: true; note?: string } | { ok: false; message: string };

interface RawUser {
  id: string;
  email?: string | null;
}

/** Structural subset of the Supabase auth client — keeps this module
 *  independent of the SDK so tests run without it. */
export interface AuthClientLike {
  getSession(): Promise<{
    data: { session: { user: RawUser; access_token?: string } | null } | null;
    error?: unknown;
  }>;
  onAuthStateChange(cb: (event: string, session: { user: RawUser } | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
  signInWithPassword(creds: {
    email: string;
    password: string;
  }): Promise<{ data: { user: RawUser | null }; error: { message?: string } | null }>;
  signUp(creds: { email: string; password: string }): Promise<{
    data: { user: RawUser | null; session: unknown };
    error: { message?: string } | null;
  }>;
  signInWithOAuth(opts: {
    provider: 'google';
    options?: { redirectTo?: string };
  }): Promise<{ data: { url?: string | null }; error: { message?: string } | null }>;
  signOut(): Promise<{ error: { message?: string } | null }>;
}

export interface AuthControllerDeps {
  /** Resolves null when Supabase is not configured. */
  clientFactory: () => Promise<AuthClientLike | null>;
  /** Idempotent profile bootstrap (insert-if-absent). */
  ensureProfile: (userId: string, timezone: string) => Promise<boolean>;
  /** Stored profile timezone, or null when absent/unreadable. */
  getProfileTimezone: (userId: string) => Promise<string | null>;
  /**
   * Server-side account wipe via the Worker endpoint (`/api/account/delete`).
   * The server derives identity from the access token; local data is only
   * cleared by the caller after this resolves true. Never throws.
   */
  requestAccountDeletion: (accessToken: string) => Promise<boolean>;
  /** Clears this device's app data. Called only after confirmed server wipe. */
  clearLocalData: () => void;
  browserTimezone: () => string;
}

export interface AuthController {
  getSnapshot(): AuthSnapshot;
  subscribe(listener: (s: AuthSnapshot) => void): () => void;
  /** Idempotent; safe under React StrictMode remounts. */
  init(): void;
  /** Unsubscribes the auth listener; no leaks. */
  dispose(): void;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  /** Redirects the browser to Google's consent screen; never resolves on success. */
  signInWithGoogle(redirectTo: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  /** Permanently deletes the account and all associated data. */
  deleteAccount(): Promise<AuthResult>;
}

/** Concise, user-readable mapping — raw server text never surfaces. */
export function mapAuthError(raw: string | undefined | null): string {
  const msg = (raw ?? '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (msg.includes('already registered'))
    return 'That email already has an account — sign in instead.';
  if (msg.includes('password should be at least') || msg.includes('weak password'))
    return 'Password is too weak — use at least 8 characters.';
  if (msg.includes('email not confirmed')) return 'Check your inbox and confirm your email first.';
  if (msg.includes('rate limit')) return 'Too many attempts — wait a moment and try again.';
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('fetch')
  )
    return 'Network unavailable — Moneo keeps working offline.';
  return 'Something went wrong. Please try again.';
}

export function createAuthController(deps: AuthControllerDeps): AuthController {
  let snapshot: AuthSnapshot = {
    status: 'loading',
    user: null,
    timezone: deps.browserTimezone(),
  };
  const listeners = new Set<(s: AuthSnapshot) => void>();
  let subscription: { unsubscribe(): void } | null = null;
  let started = false;
  let disposed = false;
  // Profile bootstrap runs once per user id, never per event.
  const profileEnsuredFor = new Set<string>();

  const emit = (next: AuthSnapshot) => {
    snapshot = next;
    listeners.forEach((l) => l(next));
  };

  const anonymous = (): AuthSnapshot => ({
    status: 'anonymous',
    user: null,
    timezone: deps.browserTimezone(),
  });

  const applyAuthenticated = async (raw: RawUser) => {
    const user: AuthIdentity = { userId: raw.id, email: raw.email ?? null };
    emit({ status: 'authenticated', user, timezone: deps.browserTimezone() });
    // Profile bootstrap: insert-if-absent with the browser timezone.
    // An existing saved timezone is NEVER overwritten.
    if (!profileEnsuredFor.has(user.userId)) {
      profileEnsuredFor.add(user.userId);
      try {
        await deps.ensureProfile(user.userId, deps.browserTimezone());
      } catch {
        /* non-fatal — profile will be retried on next sign-in */
      }
    }
    // Prefer the stored profile timezone when valid.
    let tz: string = deps.browserTimezone();
    try {
      const stored = await deps.getProfileTimezone(user.userId);
      if (isValidIanaTimezone(stored)) tz = stored;
    } catch {
      tz = deps.browserTimezone();
    }
    if (!disposed) emit({ ...snapshot, timezone: tz });
  };

  /** Honest client resolution: "not configured" vs "network failure"
   *  are distinct outcomes. Throws are propagated to callers. */
  const getClient = async (): Promise<AuthClientLike | null> => {
    return await deps.clientFactory();
  };

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    init() {
      if (started) return;
      started = true;
      disposed = false;
      void (async () => {
        let client: AuthClientLike | null = null;
        try {
          client = await getClient();
        } catch {
          if (!disposed) emit(anonymous());
          return;
        }
        if (disposed) return;
        if (!client) {
          emit(anonymous());
          return;
        }
        try {
          subscription = client.onAuthStateChange((_event, session) => {
            if (disposed) return;
            const user = session?.user ?? null;
            if (user) void applyAuthenticated(user);
            else emit(anonymous());
          }).data.subscription;
          const { data } = await client.getSession();
          if (disposed) return;
          const user = data?.session?.user ?? null;
          if (user) await applyAuthenticated(user);
          else emit(anonymous());
        } catch {
          if (!disposed) emit(anonymous());
        }
      })();
    },

    dispose() {
      disposed = true;
      started = false;
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
      listeners.clear();
    },

    async signIn(email, password) {
      let client: AuthClientLike | null = null;
      try {
        client = await getClient();
      } catch (e) {
        return {
          ok: false,
          message: mapAuthError(e instanceof Error ? e.message : null),
        };
      }
      if (!client) return { ok: false, message: 'Cloud is not configured on this installation.' };
      try {
        const { data, error } = await client.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return { ok: false, message: mapAuthError(error.message) };
        if (data.user) {
          await applyAuthenticated(data.user);
          return { ok: true };
        }
        return { ok: false, message: mapAuthError(null) };
      } catch (e) {
        return {
          ok: false,
          message: mapAuthError(e instanceof Error ? e.message : null),
        };
      }
    },

    async signInWithGoogle(redirectTo) {
      let client: AuthClientLike | null = null;
      try {
        client = await getClient();
      } catch (e) {
        return {
          ok: false,
          message: mapAuthError(e instanceof Error ? e.message : null),
        };
      }
      if (!client) return { ok: false, message: 'Cloud is not configured on this installation.' };
      try {
        const { error } = await client.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
        if (error) return { ok: false, message: mapAuthError(error.message) };
        // Success redirects the browser away — nothing left to do here.
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          message: mapAuthError(e instanceof Error ? e.message : null),
        };
      }
    },

    async signUp(email, password) {
      let client: AuthClientLike | null = null;
      try {
        client = await getClient();
      } catch (e) {
        return {
          ok: false,
          message: mapAuthError(e instanceof Error ? e.message : null),
        };
      }
      if (!client) return { ok: false, message: 'Cloud is not configured on this installation.' };
      try {
        const { data, error } = await client.signUp({
          email: email.trim(),
          password,
        });
        if (error) return { ok: false, message: mapAuthError(error.message) };
        if (data.session && data.user) {
          await applyAuthenticated(data.user);
          return { ok: true };
        }
        // Email confirmation required — signed up but not yet signed in.
        return {
          ok: true,
          note: 'Account created — check your inbox to confirm your email.',
        };
      } catch (e) {
        return {
          ok: false,
          message: mapAuthError(e instanceof Error ? e.message : null),
        };
      }
    },

    async signOut() {
      try {
        const client = await getClient();
        await client?.signOut();
      } catch {
        /* best-effort; local state resets regardless */
      }
      if (!disposed) emit(anonymous());
    },

    async deleteAccount() {
      const userId = snapshot.user?.userId;
      if (!userId) {
        return { ok: false, message: 'Not signed in.' };
      }

      let client: AuthClientLike | null = null;
      try {
        client = await getClient();
      } catch (e) {
        return {
          ok: false,
          message: mapAuthError(e instanceof Error ? e.message : null),
        };
      }
      if (!client) return { ok: false, message: 'Cloud is not configured on this installation.' };

      // The server derives identity from this token — no user id is sent.
      let accessToken: string | undefined;
      try {
        const { data } = await client.getSession();
        const token = data?.session?.access_token;
        accessToken = typeof token === 'string' && token.length > 0 ? token : undefined;
      } catch {
        accessToken = undefined;
      }
      if (!accessToken) {
        return { ok: false, message: 'Session expired — sign in again to delete your account.' };
      }

      // Server-side wipe first. Local data is untouched until it succeeds,
      // so a failure or retry can never strand the user without their data.
      let wiped = false;
      try {
        wiped = await deps.requestAccountDeletion(accessToken);
      } catch {
        wiped = false;
      }
      if (!wiped) {
        return {
          ok: false,
          message: 'Could not delete your account. Nothing was removed — please try again.',
        };
      }

      // Confirmed: clear this device, then sign out.
      try {
        deps.clearLocalData();
      } catch {
        /* best-effort; sign-out still proceeds */
      }
      try {
        await client.signOut();
      } catch {
        /* best-effort; local state resets regardless */
      }
      if (!disposed) emit(anonymous());
      return { ok: true };
    },
  };
}
