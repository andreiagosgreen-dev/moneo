/**
 * Single source of truth for the legal / contact facts shown on Terms,
 * Privacy, Refund, Help, pricing and every "contact support" link.
 * When a company is registered, update SELLER here (and review the texts).
 */

export type LegalLang = 'en' | 'ro';

export const SELLER = {
  name: 'Teleaga Andrei',
  entity: { en: 'a private individual', ro: 'persoană fizică' },
  country: { en: 'the Republic of Moldova', ro: 'Republica Moldova' },
} as const;

export const SUPPORT_EMAIL = 'atsolutionsrl@gmail.com';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

export const SITE_URL = 'https://moneo.bond';

/** Fixed on purpose — bump by hand whenever the legal texts change. */
export const LEGAL_LAST_UPDATED = '2026-09-27';

export const REFUND_DAYS = 14;

export const MERCHANT_OF_RECORD = 'Lemon Squeezy';

export type LegalDocId = 'terms' | 'privacy' | 'refund';

export const LEGAL_DOCS: readonly LegalDocId[] = ['terms', 'privacy', 'refund'];

export const LEGAL_PATHS: Record<LegalDocId, string> = {
  terms: '/terms',
  privacy: '/privacy',
  refund: '/refund',
};

/** "September 27, 2026" / "27 septembrie 2026" — UTC so it never shifts a day. */
export function formatLegalDate(lang: LegalLang, iso: string = LEGAL_LAST_UPDATED): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(lang === 'ro' ? 'ro-RO' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
