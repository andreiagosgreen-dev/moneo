/**
 * Build-time render of Terms / Privacy / Refund (scripts/prerender-landing.mjs).
 *
 * `/privacy` & co. are SPA routes, so crawlers and compliance checkers that
 * don't run JavaScript used to see an empty page. The build now puts the
 * real document into the shell, rendered by the same LegalPage component in
 * Romanian (the operator is in Moldova); the SPA boots as usual and shows it
 * in the visitor's language.
 */

import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import LegalPage from './LegalPage';
import { LocaleProvider } from '../../lib/i18n/LocaleContext';
import { loadDictionary } from '../../lib/i18n';
import type { Locale } from '../../lib/i18n/types';
import { getLegalDoc } from '../../lib/legal/content';
import { LEGAL_DOCS, LEGAL_PATHS, SUPPORT_EMAIL, type LegalDocId } from '../../lib/legal/seller';

const SITE = 'https://moneo.bond';
export const LEGAL_PRERENDER_LOCALE: Locale = 'ro';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text of a legal paragraph, tokens spelled out, cut for a meta description. */
function summary(text: string): string {
  const plain = text
    .replace(/\{email\}/g, SUPPORT_EMAIL)
    .replace(/\{(\w+)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length <= 158 ? plain : `${plain.slice(0, 155).replace(/\s+\S*$/, '')}…`;
}

export interface PrerenderedLegal {
  doc: LegalDocId;
  path: string;
  locale: Locale;
  head: string;
  body: string;
}

export async function prerenderLegal(doc: LegalDocId): Promise<PrerenderedLegal> {
  const locale = LEGAL_PRERENDER_LOCALE;
  const dictionary = await loadDictionary(locale);
  const path = LEGAL_PATHS[doc];
  const content = getLegalDoc(doc, locale);

  const body = renderToString(
    <StaticRouter location={path}>
      <LocaleProvider locale={locale} dictionary={dictionary} onLocaleChange={() => {}}>
        <LegalPage doc={doc} />
      </LocaleProvider>
    </StaticRouter>,
  );

  const title = `${content.title} — Moneo`;
  const desc = summary(content.intro[0] ?? content.title);
  const url = `${SITE}${path}`;
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
  ].join('\n    ');

  return { doc, path, locale, head, body };
}

export async function prerenderAllLegal(): Promise<PrerenderedLegal[]> {
  return Promise.all(LEGAL_DOCS.map((d) => prerenderLegal(d)));
}
