import { STORAGE_KEYS } from './storage/storageKeys';
import { safeWrite } from './storage/storageAdapter';
import { isMoneoLocalKey } from './storage/moneoKeys';

/**
 * Who sees the public landing page instead of the app.
 *
 * `/welcome` always shows it (shareable link). `/` shows it only to a
 * first-time visitor: no Moneo data in this browser, no signed-in session
 * and "Start free" never clicked. Any doubt resolves to the app — the landing
 * must never stand between an existing user and their data.
 */

export const LANDING_PATH = '/welcome';

export type LandingView = 'landing' | 'app';

/** Supabase keeps the session under `sb-<project-ref>-auth-token`. */
const SESSION_KEY = /^sb-.+-auth-token$/;

/** Marketing params that may ride along on a shared `/` link. Anything else
 * (e.g. the PWA shortcut `/?action=focus`) is an app deep link. */
const TRACKING_PARAM = /^(utm_[a-z0-9_]+|ref|gclid|fbclid|msclkid)$/i;

/** sessionStorage: this tab opened `/` as a first-time visitor and hasn't
 * pressed "Start free" yet — a detour to /pricing keeps them on the landing. */
const LANDING_ACTIVE_KEY = 'moneo:landing-active';

export interface LandingInput {
  pathname: string;
  search: string;
  storageKeys: readonly string[];
  /** First-visit landing already shown in this tab (see markLandingActive). */
  activeInTab?: boolean;
}

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function onlyTrackingParams(search: string): boolean {
  const params = new URLSearchParams(search);
  for (const key of params.keys()) {
    if (!TRACKING_PARAM.test(key)) return false;
  }
  return true;
}

/** True when nothing in this browser says the person already uses Moneo. */
export function isFirstVisit(storageKeys: readonly string[]): boolean {
  return !storageKeys.some(
    (key) => key === STORAGE_KEYS.landingSeen || isMoneoLocalKey(key) || SESSION_KEY.test(key),
  );
}

export function landingView({
  pathname,
  search,
  storageKeys,
  activeInTab = false,
}: LandingInput): LandingView {
  const path = normalizePath(pathname);
  if (path === LANDING_PATH) return 'landing';
  if (path !== '/' || !onlyTrackingParams(search)) return 'app';
  if (isFirstVisit(storageKeys)) return 'landing';
  const startedOrSignedIn = storageKeys.some(
    (key) => key === STORAGE_KEYS.landingSeen || SESSION_KEY.test(key),
  );
  return activeInTab && !startedOrSignedIn ? 'landing' : 'app';
}

/** True when `/` would show the landing because this browser is new. */
export function isFirstVisitLanding(input: LandingInput): boolean {
  return (
    normalizePath(input.pathname) === '/' &&
    landingView({ ...input, activeInTab: false }) === 'landing'
  );
}

export function isLandingActiveInTab(): boolean {
  try {
    return sessionStorage.getItem(LANDING_ACTIVE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLandingActive(active: boolean): void {
  try {
    if (active) sessionStorage.setItem(LANDING_ACTIVE_KEY, '1');
    else sessionStorage.removeItem(LANDING_ACTIVE_KEY);
  } catch {
    /* storage unavailable — the in-memory state still works */
  }
}

/** Every key in `storage`. Never throws; unreadable storage yields []. */
export function readStorageKeys(storage?: Storage): string[] {
  try {
    const target = storage ?? localStorage;
    const keys: string[] = [];
    for (let i = 0; i < target.length; i++) {
      const key = target.key(i);
      if (key !== null) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

export function markLandingSeen(): boolean {
  return safeWrite(STORAGE_KEYS.landingSeen, true);
}
