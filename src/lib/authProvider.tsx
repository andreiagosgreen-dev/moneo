import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createAuthController,
  type AuthClientLike,
  type AuthController,
  type AuthResult,
  type AuthSnapshot,
} from "./authController";
import { getSupabaseClient } from "./supabase";
import { getBrowserTimezone } from "./timezone";
import { ensureProfile, getProfileTimezone, deleteUserData } from "./cloud/profileRepository";

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
        // The Supabase client satisfies AuthClientLike structurally at
        // runtime; the cast bridges its wider generic signatures.
        clientFactory: async () =>
          (await getSupabaseClient()) as unknown as AuthClientLike | null,
        ensureProfile: (userId, timezone) => ensureProfile(userId, timezone),
        getProfileTimezone: (userId) => getProfileTimezone(userId),
        deleteUserData: (userId) => deleteUserData(userId),
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
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<AuthResult>;
}

export function useAuth(): AuthApi {
  const controller = useContext(AuthContext);
  if (!controller) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  const snapshot = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
  );
  const { signIn, signUp, signOut, deleteAccount } = controller;
  return useMemo(
    () => ({ ...snapshot, signIn, signUp, signOut, deleteAccount }),
    [snapshot, signIn, signUp, signOut, deleteAccount],
  );
}
