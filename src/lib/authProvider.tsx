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
import { resolveIsPro } from './billing/complimentaryPro';

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
        // `signInWithPassword`/`signUp`/`getSession`/`onAuthStateChange` live
        // on the client's `.auth` sub-object, not the top-level client — the
        // cast bridges its wider generic signatures to AuthClientLike.
        clientFactory: async () =>
          ((await getSupabaseClient())?.auth ?? null) as unknown as AuthClientLike | null,
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
  signIn(email: string, password: string, captchaToken?: string): Promise<AuthResult>;
  signUp(email: string, password: string, captchaToken?: string): Promise<AuthResult>;
  signInWithGoogle(redirectTo: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<AuthResult>;
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

  // After Lemon checkout the tab often stays open on Free — re-fetch when
  // the user returns so Pro unlocks without a hard reload.
  useEffect(() => {
    if (!snapshot.user?.userId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshSubscription();
    };
    const onFocus = () => {
      void refreshSubscription();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [snapshot.user?.userId, refreshSubscription]);

  const { signIn, signUp, signInWithGoogle, signOut, deleteAccount } = controller;
  // Complimentary accounts: Free Lemon/plan branding (`subscription` stays
  // free) + full Pro entitlements via `isPro`. Not a paid subscription.
  const isPro = resolveIsPro(subscription.isPro, snapshot.user?.email ?? null);
  return useMemo(
    () => ({
      ...snapshot,
      isPro,
      subscription,
      refreshSubscription,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      deleteAccount,
    }),
    [
      snapshot,
      isPro,
      subscription,
      refreshSubscription,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      deleteAccount,
    ],
  );
}
