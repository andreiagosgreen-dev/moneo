import { describe, expect, it } from 'vitest';
import { MOTTOS, MOTTO_DEFS, mottoForDay, resolveMottoLocale } from './mottos';

describe('resolveMottoLocale', () => {
  it('accepts locale ids and BCP-47 tags', () => {
    expect(resolveMottoLocale('ro')).toBe('ro');
    expect(resolveMottoLocale('ro-RO')).toBe('ro');
    expect(resolveMottoLocale('en-US')).toBe('en');
    expect(resolveMottoLocale('xx')).toBe('en');
  });
});

describe('mottoForDay', () => {
  it('returns a motto from the library', () => {
    const m = mottoForDay('2026-9-25', 'en');
    expect(MOTTOS.some((x) => x.id === m.id)).toBe(true);
    expect(m.text.length).toBeGreaterThan(0);
    expect(m.source.length).toBeGreaterThan(0);
  });

  it('is stable for the same day key', () => {
    expect(mottoForDay('2026-9-25', 'en')).toEqual(mottoForDay('2026-9-25', 'en'));
  });

  it('keeps the same motto id across locales, changing only the text', () => {
    const en = mottoForDay('2026-9-25', 'en');
    const ro = mottoForDay('2026-9-25', 'ro');
    expect(ro.id).toBe(en.id);
    expect(ro.source).toBe(en.source);
    expect(ro.text).not.toBe(en.text);
    expect(ro.text.length).toBeGreaterThan(0);
  });

  it('localizes for every supported locale', () => {
    const locales = ['en', 'ro', 'ru', 'uk', 'de', 'it', 'fr', 'es'] as const;
    const def = MOTTO_DEFS.find((m) => m.id === mottoForDay('2026-3-1', 'en').id)!;
    for (const loc of locales) {
      const m = mottoForDay('2026-3-1', loc);
      expect(m.text).toBe(def.text[loc]);
    }
  });

  it('can differ across days', () => {
    const a = mottoForDay('2026-1-1');
    const b = mottoForDay('2026-6-15');
    const c = mottoForDay('2026-12-31');
    const ids = new Set([a.id, b.id, c.id]);
    expect(ids.size).toBeGreaterThanOrEqual(2);
  });
});
