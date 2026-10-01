import type { Locale } from '../../i18n/types';
import type { LegalDocId, LegalLang } from '../seller';
import type { LegalDoc, LegalSet } from '../types';
import { legalEn } from './en';
import { legalRo } from './ro';
import { legalRu } from './ru';
import { legalUk } from './uk';
import { legalDe } from './de';
import { legalFr } from './fr';
import { legalEs } from './es';
import { legalIt } from './it';

const SETS: Record<LegalLang, LegalSet> = {
  en: legalEn,
  ro: legalRo,
  ru: legalRu,
  uk: legalUk,
  de: legalDe,
  fr: legalFr,
  es: legalEs,
  it: legalIt,
};

export function getLegalDoc(doc: LegalDocId, lang: LegalLang): LegalDoc {
  return SETS[lang][doc];
}

/** Every interface language has a full translation; English stays binding. */
export function legalLangFor(locale: Locale): LegalLang {
  return locale;
}
