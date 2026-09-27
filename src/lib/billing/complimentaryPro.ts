/**
 * Complimentary Pro entitlements — full feature unlock without Lemon pay.
 *
 * Product intent: listed accounts keep Free plan branding (`planId` / Lemon
 * row stay free) while `isPro` is true everywhere gating uses it.
 * This is NOT a paid Lemon subscription; no customer portal / renewals.
 *
 * Security honesty: most Pro gates are already client-side (`auth.isPro`).
 * Calendar + Focus Buddy also check Pro on the Worker — those paths must
 * honor the same allowlist (see `cloudflare/workers/complimentaryPro.ts`
 * + `PRO_COMPLIMENTARY_EMAILS` wrangler var).
 *
 * Fill the 2 personal emails in `COMPLIMENTARY_PRO_EMAILS` and/or set
 * `VITE_PRO_COMPLIMENTARY_EMAILS` (comma-separated) in `.env.local` / CI.
 * Emails are identities, not secrets — safe in the client bundle.
 */

/** Permanent personal allowlist (edit in-repo). Prefer this for fixed accounts. */
export const COMPLIMENTARY_PRO_EMAILS: readonly string[] = [
  'atsolutionsrl.md@gmail.com',
  'sandamihailov3@gmail.com',
];

export function normalizeComplimentaryEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Parse comma/whitespace-separated env allowlist into normalized emails. */
export function parseComplimentaryProEmails(raw: string | undefined | null): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\s]+/)) {
    const n = normalizeComplimentaryEmail(part);
    if (!n || !n.includes('@') || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * Merge hardcoded list + optional env string (deduped, normalized).
 * Empty inputs → empty allowlist (fail-closed: no complimentary Pro).
 */
export function resolveComplimentaryAllowlist(
  envRaw?: string | null,
  hardcoded: readonly string[] = COMPLIMENTARY_PRO_EMAILS,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...hardcoded, ...parseComplimentaryProEmails(envRaw)]) {
    const n = normalizeComplimentaryEmail(e);
    if (!n || !n.includes('@') || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** Client bundle: hardcoded + `VITE_PRO_COMPLIMENTARY_EMAILS`. */
export function clientComplimentaryAllowlist(): string[] {
  const envRaw =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_PRO_COMPLIMENTARY_EMAILS as string | undefined)
      : undefined;
  return resolveComplimentaryAllowlist(envRaw);
}

export function hasComplimentaryPro(
  email: string | null | undefined,
  allowlist: readonly string[] = clientComplimentaryAllowlist(),
): boolean {
  if (!email) return false;
  const n = normalizeComplimentaryEmail(email);
  if (!n) return false;
  return allowlist.some((e) => normalizeComplimentaryEmail(e) === n);
}

/** Paid Lemon active OR complimentary allowlist → Pro entitlements. */
export function resolveIsPro(
  paidIsPro: boolean,
  email: string | null | undefined,
  allowlist?: readonly string[],
): boolean {
  return paidIsPro || hasComplimentaryPro(email, allowlist);
}
