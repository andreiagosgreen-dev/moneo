/**
 * Shared Vite environment reader (Roadmap Faza 1.1).
 *
 * Single copy of the `import.meta.env` guard previously triplicated in
 * Supabase, Lemon Squeezy and email modules. Never throws; returns an
 * empty record outside a Vite context (tests, workers, SSR).
 */

export function readEnv(): Record<string, string | undefined> {
  try {
    const meta = import.meta as unknown as {
      env?: Record<string, string | undefined>;
    };
    return meta.env ?? {};
  } catch {
    return {};
  }
}
