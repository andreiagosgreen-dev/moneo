import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  createAuthController,
  type AuthClientLike,
  type AuthController,
  type AuthResult,
  type AuthSnapshot,
} from './authController';
import { getSupabaseClient } from './supabase';
import { getBrowserTimezone } from './timezone';
import { ensureProfile, getProfileTimezone } from './cloud/profileRepository';
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRemove } from './storage/storageAdapter';
import {
  fetchSubscription,
  DEFAULT_FREE_SUBSCRIPTION,
  type SubscriptionInfo,
} from './cloud/subscriptionRepository';

/**
 * Thin React wrapper around the framework-free auth controller.
 * Auth loading NEVER blocks rendering — the local app mounts immediately
 * and the account controls settle independently.
 */

const AuthContext = createContext<AuthController | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const controller = useMemo<AuthController>(
    () =>
      createAuthController({
        // supabase-js exposes getSession/signInWithPassword/onAuthStateChange
        // etc. on the `.auth` (GoTrueClient) namespace, not on the top-level
        // client — AuthClientLike models that namespace's shape, so this
        // must hand over `client.auth`, never the client itself.
        clientFactory: async () => {
          const client = await getSupabaseClient();
          return (client?.auth as unknown as AuthClientLike) ?? null;
        },
        ensureProfile: (userId, timezone) => ensureProfile(userId, timezone),
        getProfileTimezone: (userId) => getProfileTimezone(userId),
        // Same-origin Worker endpoint (serves the frontend in production).
        // Unreachable in dev → the promise rejects → controller fails closed.
        requestAccountDeletion: async (accessToken) => {
          try {
            const res = await fetch('/api/account/delete', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
            });
            return res.ok;
          } catch {
            return false;
          }
        },
        // Only invoked after the server confirms the wipe.
        clearLocalData: () => {
          try {
            for (const key of Object.values(STORAGE_KEYS)) safeRemove(key);
          } catch {
            /* best-effort */
          }
        },
        browserTimezone: getBrowserTimezone,
      }),
    [],
  );

  useEffect(() => {
    controller.init();
    return () => controller.dispose();
  }, [controller]);

  return <AuthContext.Provider value={controller}>{children}</AuthContext.Provider>;
}

export interface AuthApi extends AuthSnapshot {
  isPro: boolean;
  subscription: SubscriptionInfo;
  refreshSubscription(): Promise<void>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<AuthResult>;
  /**
   * The current session's bearer token for authenticated Worker calls
   * (e.g. the AI planner). Never cached here — reads fresh from the
   * Supabase client each time. Null when signed out, Supabase isn't
   * configured, or the session lookup fails; callers must treat null as
   * "skip the authenticated call", never retry-loop on it.
   */
  getAccessToken(): Promise<string | null>;
}

export function useAuth(): AuthApi {
  const controller = useContext(AuthContext);
  if (!controller) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  const snapshot = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
  );

  const [subscription, setSubscription] = useState<SubscriptionInfo>(DEFAULT_FREE_SUBSCRIPTION);

  const refreshSubscription = useCallback(async () => {
    if (snapshot.user?.userId) {
      const sub = await fetchSubscription(snapshot.user.userId);
      setSubscription(sub);
    } else {
      setSubscription(DEFAULT_FREE_SUBSCRIPTION);
    }
  }, [snapshot.user?.userId]);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const client = await getSupabaseClient();
      if (!client) return null;
      const { data } = await client.auth.getSession();
      const token = data?.session?.access_token;
      return typeof token === 'string' && token.length > 0 ? token : null;
    } catch {
      return null;
    }
  }, []);

  const { signIn, signUp, signOut, deleteAccount } = controller;
  return useMemo(
    () => ({
      ...snapshot,
      isPro: subscription.isPro,
      subscription,
      refreshSubscription,
      signIn,
      signUp,
      signOut,
      deleteAccount,
      getAccessToken,
    }),
    [
      snapshot,
      subscription,
      refreshSubscription,
      signIn,
      signUp,
      signOut,
      deleteAccount,
      getAccessToken,
    ],
  );
}
