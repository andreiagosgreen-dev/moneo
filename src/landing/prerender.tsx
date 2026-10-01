/**
 * Build-time render of the landing page (scripts/prerender-landing.mjs).
 *
 * Search engines and link previews get the real landing content, localized
 * head tags (title, description, canonical, hreflang) and structured data
 * (SoftwareApplication with prices + FAQPage), instead of an empty shell. The
 * browser still boots the normal SPA, which replaces this markup.
 */

import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import LandingPage from './LandingPage';
import { loadLandingDictionary } from './dictionaries';
import { createI18n } from '../lib/i18n';
import type { Locale, TKey } from '../lib/i18n/types';
import { PRO_PRICES, parseUsd } from '../lib/billing/prices';
import { ADULT_AGE, DIGITAL_CONSENT_AGE, MIN_ACCOUNT_AGE, REFUND_DAYS } from '../lib/legal/seller';

export const SITE = 'https://moneo.bond';
export const PRERENDER_LOCALES: readonly Locale[] = [
  'en',
  'ro',
  'ru',
  'uk',
  'de',
  'fr',
  'es',
  'it',
];

/** `/welcome` for English, `/ro` … for the others. */
export function landingPathFor(locale: Locale): string {
  return locale === 'en' ? '/welcome' : `/${locale}`;
}

const FAQ_IDS = [
  'free',
  'account',
  'data',
  'cancel',
  'refund',
  'devices',
  'offline',
  'ai',
] as const;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface PrerenderedLanding {
  locale: Locale;
  path: string;
  body: string;
  head: string;
}

export async function prerenderLanding(locale: Locale): Promise<PrerenderedLanding> {
  const dictionary = await loadLandingDictionary(locale);
  const { t } = createI18n(locale, dictionary);
  const path = landingPathFor(locale);

  const body = renderToString(
    <StaticRouter location={path}>
      <LandingPage
        initialLocale={locale}
        initialDictionary={dictionary}
        onStart={() => {}}
        onPrefetchApp={() => {}}
      />
    </StaticRouter>,
  );

  const title = t('land.meta.title');
  const desc = t('land.meta.desc');
  const url = `${SITE}${path}`;
  const alternates = PRERENDER_LOCALES.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${landingPathFor(l)}" />`,
  ).join('\n    ');

  const app = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Moneo',
    url,
    applicationCategory: 'ProductivityApplication',
    operatingSystem: 'Web, Android, iOS, Windows, macOS',
    description: desc,
    inLanguage: locale,
    offers: [
      { '@type': 'Offer', name: t('pricing.plan.free.name'), price: '0', priceCurrency: 'USD' },
      {
        '@type': 'Offer',
        name: t('pricing.plan.proMonthly.name'),
        price: String(parseUsd(PRO_PRICES.monthly)),
        priceCurrency: 'USD',
      },
      {
        '@type': 'Offer',
        name: t('pricing.plan.proYearly.name'),
        price: String(parseUsd(PRO_PRICES.yearly)),
        priceCurrency: 'USD',
      },
    ],
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: FAQ_IDS.map((id) => ({
      '@type': 'Question',
      name: t(`land.faq.${id}.q` as TKey),
      acceptedAnswer: {
        '@type': 'Answer',
        text: t(`land.faq.${id}.a` as TKey, {
          days: REFUND_DAYS,
          min: MIN_ACCOUNT_AGE,
          adult: ADULT_AGE,
          consent: DIGITAL_CONSENT_AGE,
        }),
      },
    })),
  };
  // `<` is escaped so no answer text can close the script element.
  const ld = (o: unknown) =>
    `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<link rel="canonical" href="${url}" />`,
    alternates,
    `<link rel="alternate" hreflang="x-default" href="${SITE}/welcome" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:locale" content="${locale}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    ld(app),
    ld(faq),
  ].join('\n    ');

  return { locale, path, body, head };
}
