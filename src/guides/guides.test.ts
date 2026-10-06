import { describe, expect, it } from 'vitest';
import { GUIDES, GUIDE_BASE, GUIDE_LOCALES, guidePath } from './index';
import { escapeHtml, plainText, renderMarkdown } from './markdown';
import { readMinutes, renderGuideSite } from './render';

const ids = (locale: (typeof GUIDE_LOCALES)[number]) => GUIDES[locale].map((g) => g.id).sort();
const allPaths = new Set(
  GUIDE_LOCALES.flatMap((l) => [GUIDE_BASE[l], ...GUIDES[l].map((g) => guidePath(l, g.slug))]),
);

describe('guide content', () => {
  it('has every guide in every language', () => {
    for (const l of GUIDE_LOCALES) expect(ids(l)).toEqual(ids('en'));
  });

  it('uses unique, URL-safe slugs', () => {
    for (const l of GUIDE_LOCALES) {
      const slugs = GUIDES[l].map((g) => g.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('keeps titles and descriptions within search-result lengths', () => {
    for (const l of GUIDE_LOCALES) {
      for (const g of GUIDES[l]) {
        expect(g.description.length, g.id + ' ' + l).toBeGreaterThanOrEqual(70);
        expect(g.description.length, g.id + ' ' + l).toBeLessThanOrEqual(160);
        expect(g.title.length, g.id + ' ' + l).toBeLessThanOrEqual(80);
      }
    }
  });

  it('links only to guides that exist, in the same language', () => {
    for (const l of GUIDE_LOCALES) {
      for (const g of GUIDES[l]) {
        for (const [, href] of g.body.matchAll(/\]\(([^)]+)\)/g)) {
          expect(allPaths.has(href), `${l}/${g.slug} → ${href}`).toBe(true);
          expect(href.startsWith(GUIDE_BASE[l])).toBe(true);
        }
      }
    }
  });

  it('is long enough to be useful', () => {
    for (const l of GUIDE_LOCALES) {
      for (const g of GUIDES[l]) {
        expect(plainText(g.body).split(/\s+/).length, g.id + ' ' + l).toBeGreaterThanOrEqual(280);
        expect(readMinutes(g.body)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('renderMarkdown', () => {
  it('renders the supported blocks and inline marks', () => {
    const html = renderMarkdown(
      '## Title\n\nA **bold** [link](/guides).\n\n- one\n- two\n\n1. first\n2. second\n\n> tip',
    );
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<p>A <strong>bold</strong> <a href="/guides">link</a>.</p>');
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(html).toContain('<ol><li>first</li><li>second</li></ol>');
    expect(html).toContain('<aside class="g-tip">tip</aside>');
  });

  it('escapes markup and refuses unsafe links', () => {
    const html = renderMarkdown('<script>x</script> [a](javascript:alert(1))');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript');
    expect(escapeHtml(`"'<>&`)).toBe('&quot;&#39;&lt;&gt;&amp;');
  });
});

describe('renderGuideSite', () => {
  const site = renderGuideSite('/assets/guides-test.css');

  it('builds an index and a page per guide and language', () => {
    const expected = GUIDE_LOCALES.reduce((n, l) => n + 1 + GUIDES[l].length, 0);
    expect(site.pages).toHaveLength(expected);
    expect(new Set(site.pages.map((p) => p.path))).toEqual(allPaths);
  });

  it('gives each page its canonical, translations and structured data', () => {
    const ro = site.pages.find((p) => p.path === '/ro/ghiduri/tehnica-pomodoro')!.html;
    expect(ro).toContain('<html lang="ro">');
    expect(ro).toContain(
      '<link rel="canonical" href="https://moneo.bond/ro/ghiduri/tehnica-pomodoro" />',
    );
    expect(ro).toContain(
      'hreflang="en" href="https://moneo.bond/guides/pomodoro-technique-for-studying"',
    );
    expect(ro).toContain('hreflang="ru" href="https://moneo.bond/ru/stati/metod-pomodoro"');
    expect(ro).toContain('hreflang="x-default"');
    expect(ro).toContain('"@type":"Article"');
    expect(ro).toContain('"@type":"BreadcrumbList"');
    expect(ro).toContain('utm_source=guide');
    expect(ro).toContain('/assets/guides-test.css');
    expect(ro).not.toContain('/src/main.tsx');
  });

  it('adds every page to the sitemap', () => {
    for (const path of allPaths)
      expect(site.sitemap).toContain(`<loc>https://moneo.bond${path}</loc>`);
  });
});
