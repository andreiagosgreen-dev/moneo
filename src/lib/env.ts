/**
 * Shared Vite environment reader (Roadmap Faza 1.1).
 *
 * Single copy of the `import.meta.env` guard previously triplicated in
 * Supabase, Lemon Squeezy and email modules. Never throws; returns an
 * empty record outside a Vite context (tests, workers, SSR).
 *
 * MUST return `import.meta.env` directly, not via an intermediate
 * `const meta = import.meta` (as this used to). Vite's production build
 * only replaces the literal, contiguous `import.meta.env` expression
 * with a real inlined object — assigning `import.meta` to a variable
 * first and reading `.env` off that variable defeats the static
 * replacement entirely. That left this function returning `{}` in every
 * production build (verified: `import.meta.env` is untouched, non-native
 * syntax in the compiled output), silently disabling every optional
 * cloud feature gated by an env var (Supabase, Lemon Squeezy, Sentry) —
 * `npm run dev` never showed it because Vite's dev server provides
 * `import.meta.env` as a real live object regardless of access pattern.
 */
export function readEnv(): Record<string, string | undefined> {
  try {
    return import.meta.env ?? {};
  } catch {
    return {};
  }
}
