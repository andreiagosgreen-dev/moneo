import { describe, expect, it } from 'vitest';
import { en as enStrings } from '../i18n/locales/en';
import { getLegalDoc, legalLangFor } from './content';
import {
  ADULT_AGE,
  DIGITAL_CONSENT_AGE,
  LEGAL_DOCS,
  MIN_ACCOUNT_AGE,
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

const LANGS: LegalLang[] = ['en', 'ro', 'ru', 'uk', 'de', 'fr', 'es', 'it'];

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
  it('has the owner-confirmed support email and mailto link', () => {
    expect(SUPPORT_EMAIL).toBe('atsolutionsrl.md@gmail.com');
    expect(SUPPORT_MAILTO).toBe(`mailto:${SUPPORT_EMAIL}`);
  });

  it('never uses the look-alike mailbox without ".md" (a different Gmail inbox)', () => {
    const wrong = ['atsolutionsrl', 'gmail.com'].join('@');
    const hits = Object.entries(SOURCES)
      .filter(([, src]) => src.toLowerCase().includes(wrong))
      .map(([path]) => path);
    expect(hits).toEqual([]);
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
    // The complimentary-Pro allowlist lists the owner's account, not a contact address.
    const allowed = ['/src/lib/legal/seller.ts', '/src/lib/billing/complimentaryPro.ts'];
    const offenders = Object.entries(SOURCES)
      .filter(
        ([path, src]) =>
          !allowed.includes(path) && !path.endsWith('.test.ts') && src.includes(SUPPORT_EMAIL),
      )
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});

describe('legal content', () => {
  it('shows every interface language its own translation', () => {
    for (const l of LANGS) expect(legalLangFor(l)).toBe(l);
  });

  it('every translation mirrors the English structure block by block', () => {
    for (const lang of LANGS) {
      for (const id of LEGAL_DOCS) {
        const en = getLegalDoc(id, 'en');
        const tr = getLegalDoc(id, lang);
        expect(tr.intro.length, `${lang} ${id}`).toBe(en.intro.length);
        expect(tr.sections.length, `${lang} ${id}`).toBe(en.sections.length);
        tr.sections.forEach((s, i) => {
          expect(s.blocks.length, `${lang} ${id} §${i + 1}`).toBe(en.sections[i].blocks.length);
          s.blocks.forEach((b, j) => {
            const enBlock = en.sections[i].blocks[j];
            const isList = typeof b !== 'string';
            expect(isList, `${lang} ${id} §${i + 1}.${j + 1}`).toBe(typeof enBlock !== 'string');
            if (isList && typeof enBlock !== 'string') {
              expect(b.list.length, `${lang} ${id} §${i + 1}.${j + 1}`).toBe(enBlock.list.length);
            }
          });
        });
      }
    }
  });

  it('keeps every link token of the English original in each translation', () => {
    const tokens = (text: string) => (text.match(/\{[a-z]+\}/g) ?? []).sort();
    for (const lang of LANGS) {
      for (const id of LEGAL_DOCS) {
        expect(tokens(allText(getLegalDoc(id, lang))), `${lang} ${id}`).toEqual(
          tokens(allText(getLegalDoc(id, 'en'))),
        );
      }
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
        const denials = (
          text.match(
            /not end-to-end|nu oferă criptare end-to-end|non è crittografato end-to-end/g,
          ) ?? []
        ).length;
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
  });

  it('describes cookieless Cloudflare Web Analytics instead of claiming none', () => {
    for (const lang of LANGS) {
      const privacy = allText(getLegalDoc('privacy', lang));
      expect(privacy.split('Cloudflare Web Analytics').length - 1, lang).toBeGreaterThanOrEqual(3);
    }
    const en = allText(getLegalDoc('privacy', 'en'));
    expect(en).not.toMatch(/no analytics/i);
    expect(en).toContain('cookieless');
    expect(en).toContain('no cross-site tracking');
    expect(en).toContain('legitimate interest in improving the Service');
  });

  it('points access/portability to the free JSON export, not a Pro-only export', () => {
    for (const lang of LANGS) {
      const text = [allText(getLegalDoc('privacy', lang)), allText(getLegalDoc('terms', lang))];
      for (const t of text) {
        expect(t).toContain('JSON');
        expect(t).not.toMatch(/Pro users can export|utilizatorii Pro pot exporta|exportul Pro/);
      }
    }
  });

  it('keeps Pro active until the end of the paid period after cancelling', () => {
    expect(allText(getLegalDoc('terms', 'en'))).toContain(
      'you keep Pro until the end of the period you already paid for',
    );
    expect(allText(getLegalDoc('terms', 'ro'))).toContain(
      'păstrezi Pro până la sfârșitul perioadei deja plătite',
    );
  });

  it('sets the age rules: 13+ for an account, guardian permission under 18', () => {
    expect(MIN_ACCOUNT_AGE).toBe(13);
    expect(ADULT_AGE).toBe(18);
    expect(DIGITAL_CONSENT_AGE).toBe(16);

    const terms = allText(getLegalDoc('terms', 'en'));
    expect(terms).toContain('To create an account you must be at least 13 years old.');
    expect(terms).toContain(
      'If you are under 18, you may use Moneo only with the permission of a parent or legal guardian.',
    );
    expect(terms).toContain('(16 in many EU countries), a parent or legal guardian must agree');
    expect(terms).toContain(
      'A Pro subscription for someone under 18 must be bought by a parent or legal guardian, or with their permission.',
    );
    expect(terms).toContain('governed by applicable law');
    expect(terms).toContain('You can use it without an account');
    expect(terms).not.toMatch(/at least 16/);

    const ro = allText(getLegalDoc('terms', 'ro'));
    expect(ro).toContain('Ca să creezi un cont trebuie să ai cel puțin 13 ani.');
    expect(ro).toContain('Dacă ai sub 18 ani');
    expect(ro).toContain('legea aplicabilă');
    expect(ro).not.toMatch(/cel puțin 16/);

    expect(
      enStrings['legal.ageNote']
        .replace('{min}', String(MIN_ACCOUNT_AGE))
        .replace('{n}', String(ADULT_AGE)),
    ).toBe('Accounts are for ages 13+. Under 18? Get a parent’s or guardian’s permission first.');

    const landingMinors = enStrings['land.faq.minors.a']
      .replace('{min}', String(MIN_ACCOUNT_AGE))
      .split('{adult}')
      .join(String(ADULT_AGE))
      .replace('{consent}', String(DIGITAL_CONSENT_AGE));
    expect(landingMinors).toContain('To create an account you must be at least 13.');
    expect(landingMinors).toContain('If you’re under 18, use Moneo only with the permission');
    expect(landingMinors).toContain('(16 in many EU countries), a parent or guardian must agree');
  });

  it('Terms say Moneo helps but promises no results, and Move is not medical advice', () => {
    for (const lang of LANGS) {
      const doc = getLegalDoc('terms', lang);
      const sec = doc.sections.find((s) => s.heading.startsWith('3.'));
      expect(sec, lang).toBeDefined();
      expect(sec!.blocks, lang).toHaveLength(4);
    }
    const en = getLegalDoc('terms', 'en').sections.find((s) => s.heading.startsWith('3.'))!;
    const enText = allText({ ...getLegalDoc('terms', 'en'), intro: [], sections: [en] });
    expect(enText).toContain('We do not promise any particular outcome');
    expect(enText).toContain('not medical, physiotherapy or nutrition advice');
    expect(enText).toContain('Talk to a doctor before you start a new exercise program');
  });

  it('Privacy has a children and students section with guardian contact', () => {
    for (const lang of LANGS) {
      const doc = getLegalDoc('privacy', lang);
      const sec = doc.sections.find((s) => s.heading.startsWith('12.'));
      expect(sec, lang).toBeDefined();
      const text = allText({ ...doc, intro: [], sections: [sec!] });
      expect(text).toContain('{email}');
      expect(text).toContain(String(MIN_ACCOUNT_AGE));
      expect(text).toContain(String(DIGITAL_CONSENT_AGE));
    }
    const en = getLegalDoc('privacy', 'en').sections.find((s) => s.heading.startsWith('12.'))!;
    expect(en.heading).toBe('12. Children and students');
    const enText = allText({ ...getLegalDoc('privacy', 'en'), intro: [], sections: [en] });
    expect(enText).toContain('Without an account, nothing is sent to us');
    expect(enText).toContain('No advertising, no profiling and no selling of data');
    expect(enText).toContain(
      'If we learn that a child under 13 has created an account, we delete the account and its data.',
    );
    expect(enText).not.toMatch(/not directed at children under 16/);
  });

  it('Romanian lists have the same number of items as the English ones', () => {
    for (const id of LEGAL_DOCS) {
      const en = getLegalDoc(id, 'en');
      const ro = getLegalDoc(id, 'ro');
      en.sections.forEach((s, i) =>
        s.blocks.forEach((b, j) => {
          const rb = ro.sections[i].blocks[j];
          if (typeof b === 'string') expect(typeof rb, `${id} §${i + 1}.${j}`).toBe('string');
          else expect(typeof rb === 'string' ? -1 : rb.list.length).toBe(b.list.length);
        }),
      );
    }
  });
});
