import type { Locale } from '../../i18n/types';
import type { LegalDocId, LegalLang } from '../seller';
import type { LegalDoc, LegalSet } from '../types';
import { legalEn } from './en';
import { legalRo } from './ro';

const SETS: Record<LegalLang, LegalSet> = { en: legalEn, ro: legalRo };

export function getLegalDoc(doc: LegalDocId, lang: LegalLang): LegalDoc {
  return SETS[lang][doc];
}

/** English everywhere except Romanian, the only full translation. */
export function legalLangFor(locale: Locale): LegalLang {
  return locale === 'ro' ? 'ro' : 'en';
}
