/**
 * Worker-side complimentary Pro allowlist.
 *
 * Mirrors `src/lib/billing/complimentaryPro.ts` (keep parse/match in sync).
 * Emails are identities, not secrets — set `PRO_COMPLIMENTARY_EMAILS` in
 * wrangler `[vars]` (comma-separated), matching the Vite client list.
 *
 * Complimentary = Free Lemon branding + Pro entitlements; not a paid sub.
 */

/** Same permanent list as `COMPLIMENTARY_PRO_EMAILS` in the client module. */
export const COMPLIMENTARY_PRO_EMAILS: readonly string[] = [
  'atsolutionsrl.md@gmail.com',
  'sandamihailov3@gmail.com',
];

export function normalizeComplimentaryEmail(email: string): string {
  return email.trim().toLowerCase();
}

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

export function hasComplimentaryPro(
  email: string | null | undefined,
  allowlist: readonly string[],
): boolean {
  if (!email) return false;
  const n = normalizeComplimentaryEmail(email);
  if (!n) return false;
  return allowlist.some((e) => normalizeComplimentaryEmail(e) === n);
}
