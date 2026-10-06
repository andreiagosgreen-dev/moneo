/**
 * Build-time HTML for the guides (scripts/prerender-landing.mjs): one page
 * per guide and language plus an index per language, and their sitemap
 * entries. Plain static pages — no SPA boot — with canonical, hreflang
 * between translations and Article + BreadcrumbList structured data.
 */

import { GUIDE_BASE, GUIDE_LOCALES, GUIDE_UI, GUIDES, findGuide, guidePath } from './index';
import { escapeHtml as esc, plainText, renderMarkdown } from './markdown';
import type { Guide, GuideLocale } from './types';

export const SITE = 'https://moneo.bond';
/** Date of the current guide texts (Article dates, sitemap lastmod). */
export const GUIDES_UPDATED = '2026-10-06';

const LANDING: Record<GuideLocale, string> = { en: '/welcome', ro: '/ro', ru: '/ru' };

export function readMinutes(body: string): number {
  const words = plainText(body).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

const ld = (o: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

/** Landing link carrying where the visitor came from (funnel report). */
function startHref(locale: GuideLocale, campaign: string): string {
  return `${LANDING[locale]}?utm_source=guide&utm_medium=organic&utm_campaign=${campaign}`;
}

interface Shell {
  locale: GuideLocale;
  path: string;
  title: string;
  description: string;
  alternates: Array<{ locale: GuideLocale; path: string }>;
  jsonLd: unknown[];
  main: string;
  cssHref: string;
}

function page(s: Shell): string {
  const ui = GUIDE_UI[s.locale];
  const url = `${SITE}${s.path}`;
  const alt = s.alternates
    .map((a) => `<link rel="alternate" hreflang="${a.locale}" href="${SITE}${a.path}" />`)
    .join('\n    ');
  const xDefault = s.alternates.find((a) => a.locale === 'en');
  return `<!doctype html>
<html lang="${s.locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${esc(s.title)}</title>
    <meta name="description" content="${esc(s.description)}" />
    <link rel="canonical" href="${url}" />
    ${alt}${xDefault ? `\n    <link rel="alternate" hreflang="x-default" href="${SITE}${xDefault.path}" />` : ''}
    <meta name="theme-color" content="#17211c" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Moneo" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(s.title)}" />
    <meta property="og:description" content="${esc(s.description)}" />
    <meta property="og:locale" content="${s.locale}" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(s.title)}" />
    <meta name="twitter:description" content="${esc(s.description)}" />
    <meta name="twitter:image" content="${SITE}/og.png" />
    <link rel="stylesheet" href="${s.cssHref}" />
    ${s.jsonLd.map(ld).join('\n    ')}
  </head>
  <body class="g-body">
    <header class="g-head">
      <div class="g-wrap g-head-in">
        <a class="g-brand" href="${LANDING[s.locale]}">
          <img src="/landing/mark-64.webp" width="28" height="28" alt="" />
          <span>Moneo</span>
        </a>
        <nav class="g-nav" aria-label="${esc(ui.section)}">
          <a href="${GUIDE_BASE[s.locale]}">${esc(ui.section)}</a>
          <a class="g-btn g-btn-sm" href="${startHref(s.locale, 'guide-header')}">${esc(ui.openApp)}</a>
        </nav>
      </div>
    </header>
    <main class="g-wrap g-main">
${s.main}
    </main>
    <footer class="g-foot">
      <div class="g-wrap g-foot-in">
        <nav class="g-foot-nav">
          <a href="${GUIDE_BASE[s.locale]}">${esc(ui.section)}</a>
          <a href="/terms">${esc(ui.terms)}</a>
          <a href="/privacy">${esc(ui.privacy)}</a>
        </nav>
        <p class="g-foot-langs">${GUIDE_LOCALES.map((l) =>
          l === s.locale
            ? `<span aria-current="true">${esc(GUIDE_UI[l].languageName)}</span>`
            : `<a href="${s.alternates.find((a) => a.locale === l)?.path ?? GUIDE_BASE[l]}" hreflang="${l}" lang="${l}">${esc(GUIDE_UI[l].languageName)}</a>`,
        ).join(' · ')}</p>
        <p class="g-foot-copy">© Moneo</p>
      </div>
    </footer>
  </body>
</html>
`;
}

function breadcrumbs(locale: GuideLocale, guide?: Guide) {
  const ui = GUIDE_UI[locale];
  const items = [
    { name: 'Moneo', item: `${SITE}${LANDING[locale]}` },
    { name: ui.section, item: `${SITE}${GUIDE_BASE[locale]}` },
    ...(guide ? [{ name: guide.h1, item: `${SITE}${guidePath(locale, guide.slug)}` }] : []),
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, ...x })),
  };
}

function guidePage(locale: GuideLocale, guide: Guide, cssHref: string): string {
  const ui = GUIDE_UI[locale];
  const path = guidePath(locale, guide.slug);
  const alternates = GUIDE_LOCALES.flatMap((l) => {
    const g = findGuide(l, guide.id);
    return g ? [{ locale: l, path: guidePath(l, g.slug) }] : [];
  });
  const related = GUIDES[locale].filter((g) => g.id !== guide.id);
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.h1,
    description: guide.description,
    inLanguage: locale,
    mainEntityOfPage: `${SITE}${path}`,
    image: `${SITE}/og.png`,
    datePublished: GUIDES_UPDATED,
    dateModified: GUIDES_UPDATED,
    author: { '@type': 'Organization', name: 'Moneo', url: SITE },
    publisher: {
      '@type': 'Organization',
      name: 'Moneo',
      logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png` },
    },
  };
  const main = `      <nav class="g-crumbs" aria-label="breadcrumb"><a href="${GUIDE_BASE[locale]}">${esc(ui.section)}</a></nav>
      <article class="g-article">
        <h1>${esc(guide.h1)}</h1>
        <p class="g-meta">${esc(ui.readMin.replace('{n}', String(readMinutes(guide.body))))}</p>
${renderMarkdown(guide.body)}
        <section class="g-cta">
          <h2>${esc(ui.ctaTitle)}</h2>
          <p>${esc(guide.cta)}</p>
          <a class="g-btn" href="${startHref(locale, guide.id)}">${esc(ui.ctaButton)}</a>
        </section>
      </article>
      <section class="g-related">
        <h2>${esc(ui.related)}</h2>
        <ul>${related
          .map(
            (g) =>
              `<li><a href="${guidePath(locale, g.slug)}">${esc(g.h1)}</a><span>${esc(g.description)}</span></li>`,
          )
          .join('')}</ul>
      </section>`;
  return page({
    locale,
    path,
    title: guide.title,
    description: guide.description,
    alternates,
    jsonLd: [article, breadcrumbs(locale, guide)],
    main,
    cssHref,
  });
}

function indexPage(locale: GuideLocale, cssHref: string): string {
  const ui = GUIDE_UI[locale];
  const main = `      <header class="g-index-head">
        <h1>${esc(ui.indexH1)}</h1>
        <p class="g-lead">${esc(ui.indexIntro)}</p>
      </header>
      <ul class="g-cards">${GUIDES[locale]
        .map(
          (g) => `
        <li class="g-card">
          <a href="${guidePath(locale, g.slug)}">
            <h2>${esc(g.h1)}</h2>
            <p>${esc(g.description)}</p>
            <span class="g-meta">${esc(ui.readMin.replace('{n}', String(readMinutes(g.body))))}</span>
          </a>
        </li>`,
        )
        .join('')}
      </ul>`;
  return page({
    locale,
    path: GUIDE_BASE[locale],
    title: ui.indexTitle,
    description: ui.indexDescription,
    alternates: GUIDE_LOCALES.map((l) => ({ locale: l, path: GUIDE_BASE[l] })),
    jsonLd: [breadcrumbs(locale)],
    main,
    cssHref,
  });
}

export interface GuideSite {
  pages: Array<{ path: string; html: string }>;
  /** `<url>` entries to add to sitemap.xml. */
  sitemap: string;
}

export function renderGuideSite(cssHref: string): GuideSite {
  const pages: GuideSite['pages'] = [];
  const entries: string[] = [];
  const entry = (path: string, alts: Array<{ locale: GuideLocale; path: string }>, prio: string) =>
    [
      '  <url>',
      `    <loc>${SITE}${path}</loc>`,
      ...alts.map(
        (a) => `    <xhtml:link rel="alternate" hreflang="${a.locale}" href="${SITE}${a.path}" />`,
      ),
      `    <lastmod>${GUIDES_UPDATED}</lastmod>`,
      `    <priority>${prio}</priority>`,
      '  </url>',
    ].join('\n');

  const indexAlts = GUIDE_LOCALES.map((l) => ({ locale: l, path: GUIDE_BASE[l] }));
  for (const locale of GUIDE_LOCALES) {
    pages.push({ path: GUIDE_BASE[locale], html: indexPage(locale, cssHref) });
    entries.push(entry(GUIDE_BASE[locale], indexAlts, '0.7'));
    for (const guide of GUIDES[locale]) {
      const path = guidePath(locale, guide.slug);
      pages.push({ path, html: guidePage(locale, guide, cssHref) });
      const alts = GUIDE_LOCALES.flatMap((l) => {
        const g = findGuide(l, guide.id);
        return g ? [{ locale: l, path: guidePath(l, g.slug) }] : [];
      });
      entries.push(entry(path, alts, '0.8'));
    }
  }
  return { pages, sitemap: entries.join('\n') };
}
