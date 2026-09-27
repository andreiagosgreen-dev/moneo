/**
 * Inline link tokens inside legal texts and i18n strings, e.g.
 * "write to {email}" or "you agree to the {terms} and the {privacy}".
 * The renderer swaps each token for a real link.
 */

export const LEGAL_TOKENS = ['email', 'terms', 'privacy', 'refund', 'orders'] as const;

export type LegalToken = (typeof LEGAL_TOKENS)[number];

export type InlinePart = { kind: 'text'; text: string } | { kind: 'token'; name: LegalToken };

const TOKEN_RE = /\{(\w+)\}/g;

function isToken(name: string, allowed: readonly string[]): name is LegalToken {
  return allowed.includes(name);
}

/** Unknown `{names}` stay as plain text. Empty text parts are dropped. */
export function splitTokens(
  template: string,
  allowed: readonly LegalToken[] = LEGAL_TOKENS,
): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const m of template.matchAll(TOKEN_RE)) {
    const name = m[1];
    if (!isToken(name, allowed)) continue;
    const at = m.index ?? 0;
    if (at > last) parts.push({ kind: 'text', text: template.slice(last, at) });
    parts.push({ kind: 'token', name });
    last = at + m[0].length;
  }
  if (last < template.length) parts.push({ kind: 'text', text: template.slice(last) });
  return parts;
}
