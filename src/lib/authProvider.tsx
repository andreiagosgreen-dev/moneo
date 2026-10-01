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
import {
  fetchComplimentaryProShared,
  loadComplimentaryCache,
  resolveIsPro,
  saveComplimentaryCache,
} from './billing/complimentaryPro';
import { requestAccountDeletion } from './accountDeletionClient';

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
        requestAccountDeletion: (accessToken) => requestAccountDeletion(accessToken),
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
  requestPasswordReset(
    email: string,
    redirectTo: string,
    captchaToken?: string,
  ): Promise<AuthResult>;
  updatePassword(password: string): Promise<AuthResult>;
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
  const userId = snapshot.user?.userId ?? null;
  // Gifted Pro: last known answer first (works offline), then the Worker's.
  const [complimentary, setComplimentary] = useState(() => loadComplimentaryCache(userId));

  const refreshSubscription = useCallback(async () => {
    if (userId) {
      const [sub, gift] = await Promise.all([
        fetchSubscription(userId),
        fetchComplimentaryProShared(userId, async () => {
          const client = await getSupabaseClient();
          const { data } = (await client?.auth.getSession()) ?? { data: null };
          return data?.session?.access_token ?? null;
        }),
      ]);
      setSubscription(sub);
      if (gift !== null) {
        saveComplimentaryCache(userId, gift);
        setComplimentary(gift);
      } else {
        setComplimentary(loadComplimentaryCache(userId));
      }
    } else {
      setSubscription(DEFAULT_FREE_SUBSCRIPTION);
      setComplimentary(false);
    }
  }, [userId]);

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
  const isPro = resolveIsPro(subscription.isPro, complimentary);
  const { requestPasswordReset, updatePassword } = controller;
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
      requestPasswordReset,
      updatePassword,
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
      requestPasswordReset,
      updatePassword,
      deleteAccount,
    ],
  );
}
