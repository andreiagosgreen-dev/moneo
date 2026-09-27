import { describe, expect, it } from 'vitest';
import { getLegalDoc, legalLangFor } from './content';
import {
  LEGAL_DOCS,
  LEGAL_LAST_UPDATED,
  LEGAL_PATHS,
  REFUND_DAYS,
  SELLER,
  SUPPORT_EMAIL,
  SUPPORT_MAILTO,
  formatLegalDate,
  type LegalLang,
} from './seller';
import { LEGAL_TOKENS } from './tokens';
import type { LegalDoc } from './types';

const LANGS: LegalLang[] = ['en', 'ro'];

function allText(doc: LegalDoc): string {
  const parts = [doc.title, doc.updated, ...doc.intro];
  for (const s of doc.sections) {
    parts.push(s.heading);
    for (const b of s.blocks) parts.push(...(typeof b === 'string' ? [b] : b.list));
  }
  return parts.join('\n');
}

const SOURCES = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('seller constants', () => {
  it('has a usable support email and mailto link', () => {
    expect(SUPPORT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i);
    expect(SUPPORT_MAILTO).toBe(`mailto:${SUPPORT_EMAIL}`);
  });

  it('pins a fixed last-updated date and a 14-day refund window', () => {
    expect(LEGAL_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(REFUND_DAYS).toBe(14);
    expect(formatLegalDate('en', '2026-09-27')).toBe('September 27, 2026');
    expect(formatLegalDate('ro', '2026-09-27')).toBe('27 septembrie 2026');
  });

  it('routes every legal document, including /refund', () => {
    expect(LEGAL_DOCS).toEqual(['terms', 'privacy', 'refund']);
    expect(LEGAL_PATHS).toEqual({ terms: '/terms', privacy: '/privacy', refund: '/refund' });
  });

  it('keeps the support email in one place only', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
    expect(SOURCES['/src/lib/legal/seller.ts']).toContain(SUPPORT_EMAIL);
    const offenders = Object.entries(SOURCES)
      .filter(
        ([path, src]) => !path.endsWith('/lib/legal/seller.ts') && src.includes(SUPPORT_EMAIL),
      )
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});

describe('legal content', () => {
  it('shows English everywhere except Romanian', () => {
    expect(legalLangFor('ro')).toBe('ro');
    for (const l of ['en', 'ru', 'uk', 'de', 'it', 'fr', 'es'] as const) {
      expect(legalLangFor(l)).toBe('en');
    }
  });

  it('Romanian mirrors the English structure section by section', () => {
    for (const id of LEGAL_DOCS) {
      const en = getLegalDoc(id, 'en');
      const ro = getLegalDoc(id, 'ro');
      expect(ro.intro.length, id).toBe(en.intro.length);
      expect(ro.sections.length, id).toBe(en.sections.length);
      ro.sections.forEach((s, i) => {
        expect(s.blocks.length, `${id} §${i + 1}`).toBe(en.sections[i].blocks.length);
      });
    }
  });

  it('uses only known link tokens and routes contact through {email}', () => {
    for (const lang of LANGS) {
      for (const id of LEGAL_DOCS) {
        const text = allText(getLegalDoc(id, lang));
        const tokens = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
        for (const tok of tokens) expect(LEGAL_TOKENS, `${lang}/${id}`).toContain(tok);
        expect(text, `${lang}/${id}`).toContain('{email}');
        expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      }
    }
  });

  it('names the operator, country and date from the seller constants', () => {
    for (const lang of LANGS) {
      for (const id of ['terms', 'privacy'] as const) {
        const text = allText(getLegalDoc(id, lang));
        expect(text).toContain(SELLER.name);
        expect(text).toContain(SELLER.country[lang]);
      }
      for (const id of LEGAL_DOCS) {
        expect(getLegalDoc(id, lang).updated).toContain(formatLegalDate(lang));
      }
    }
  });

  it('states the refund window and Lemon Squeezy as Merchant of Record', () => {
    for (const lang of LANGS) {
      const refund = allText(getLegalDoc('refund', lang));
      expect(refund).toContain(String(REFUND_DAYS));
      expect(refund).toContain('Lemon Squeezy');
      expect(refund).toContain('{orders}');
    }
    expect(allText(getLegalDoc('terms', 'en'))).toContain('Merchant of Record');
  });

  it('never claims end-to-end encryption', () => {
    const en = allText(getLegalDoc('privacy', 'en'));
    expect(en).toContain('not end-to-end encrypted');
    for (const lang of LANGS) {
      for (const id of LEGAL_DOCS) {
        const text = allText(getLegalDoc(id, lang)).toLowerCase();
        const claims = text.split('end-to-end').length - 1;
        const denials = (text.match(/not end-to-end|nu oferă criptare end-to-end/g) ?? []).length;
        expect(claims, `${lang}/${id}`).toBe(denials);
      }
    }
  });

  it('lists the processors the code actually talks to', () => {
    const privacy = allText(getLegalDoc('privacy', 'en'));
    for (const name of [
      'Supabase',
      'Cloudflare',
      'Lemon Squeezy',
      'Google',
      'Sentry',
      'GitHub',
      'OpenAI',
      'DeepSeek',
      'Gemini',
    ]) {
      expect(privacy).toContain(name);
    }
    expect(privacy).toContain('133/2011');
    expect(privacy).toContain('no analytics');
  });
});
