/**
 * Shared Vite environment reader (Roadmap Faza 1.1).
 *
 * Single copy of the `import.meta.env` guard previously triplicated in
 * Supabase, Lemon Squeezy and email modules. Never throws; returns an
 * empty record outside a Vite context (tests, workers, SSR).
 */

export function readEnv(): Record<string, string | undefined> {
  try {
    // Direct `import.meta.env` access (not indirected through a variable)
    // so Vite's static analysis recognizes and replaces it at build time.
    return (import.meta.env as unknown as Record<string, string | undefined>) ?? {};
  } catch {
    return {};
  }
}
