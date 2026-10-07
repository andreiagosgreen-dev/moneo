import { describe, expect, it } from 'vitest';
import { LEGAL_DOCS, LEGAL_PATHS } from '../../lib/legal/seller';
import { prerenderAllLegal, prerenderLegal } from './prerender';

describe('prerendered legal pages', () => {
  it('puts the real privacy text into the page for crawlers without JavaScript', async () => {
    const page = await prerenderLegal('privacy');
    expect(page.path).toBe('/privacy');
    expect(page.locale).toBe('ro');
    expect(page.head).toContain('<title>Politica de confidențialitate — Moneo</title>');
    expect(page.head).toContain('<link rel="canonical" href="https://moneo.bond/privacy" />');
    expect(page.head).toMatch(/<meta name="description" content="[^"]{40,}"/);
    // What compliance checkers look for (Moldova, Law 195/2024).
    for (const text of [
      '195/2024',
      'CNPDCP',
      'Transferuri internaționale',
      'Rectificare',
      'Portabilitate',
      'Opoziție',
      'Versiunea',
      'Ultima actualizare',
    ]) {
      expect(page.body, text).toContain(text);
    }
  });

  it('renders every legal document', async () => {
    const pages = await prerenderAllLegal();
    expect(pages.map((p) => p.path)).toEqual(LEGAL_DOCS.map((d) => LEGAL_PATHS[d]));
    for (const p of pages) expect(p.body.length).toBeGreaterThan(2000);
  });
});
