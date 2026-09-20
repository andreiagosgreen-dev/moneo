import { describe, expect, it } from 'vitest';
import { createI18n, isLocale, loadLocale, LOCALES, saveLocale } from './index';
import { en } from './locales/en';
import { ro } from './locales/ro';
import { ru } from './locales/ru';
import { uk } from './locales/uk';
import { de } from './locales/de';
import { it as itDict } from './locales/it';
import { fr } from './locales/fr';
import { es } from './locales/es';
import type { Locale } from './types';

const ALL: Array<{ id: Locale; dict: Record<string, string> }> = [
  { id: 'en', dict: en },
  { id: 'ro', dict: ro },
  { id: 'ru', dict: ru },
  { id: 'uk', dict: uk },
  { id: 'de', dict: de },
  { id: 'it', dict: itDict },
  { id: 'fr', dict: fr },
  { id: 'es', dict: es },
];

describe('locale parity', () => {
  it('covers exactly the 8 required locales', () => {
    expect(LOCALES.map((l) => l.id).sort()).toEqual(
      ['de', 'en', 'es', 'fr', 'it', 'ro', 'ru', 'uk'].sort(),
    );
  });

  it('every locale has exactly the English key set (no missing, no extra)', () => {
    const base = Object.keys(en).sort();
    expect(base.length).toBeGreaterThan(100);
    for (const { id, dict } of ALL) {
      expect(Object.keys(dict).sort(), `locale ${id}`).toEqual(base);
    }
  });

  it('no value is empty and no {var} placeholder was dropped', () => {
    const base = en as Record<string, string>;
    for (const { id, dict } of ALL) {
      for (const key of Object.keys(base)) {
        const mine = dict[key] ?? '';
        expect(mine.trim().length > 0, `${id}:${key} empty`).toBe(true);
        const wantVars = [...base[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        const gotVars = [...mine.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(gotVars, `${id}:${key} placeholders`).toEqual(wantVars);
      }
    }
  });
});

describe('translator', () => {
  it('interpolates vars and falls back to the key itself when missing', () => {
    const { t } = createI18n('ro');
    expect(t('today.morning')).toBe('Ritualul de dimineață');
    expect(t('upnext.addAria', { title: 'X' })).toContain('X');
    expect(t('no.such.key' as never)).toBe('no.such.key');
  });

  it('picks plural categories per locale (one/few/many/other)', () => {
    expect(createI18n('en').tp('lifemap.tplCount', 1)).toBe('1 area');
    expect(createI18n('en').tp('lifemap.tplCount', 5)).toBe('5 areas');
    expect(createI18n('ro').tp('lifemap.review.mixed', 1, { names: 'X' })).toContain('1 arie');
    expect(createI18n('ro').tp('lifemap.review.mixed', 2, { names: 'X' })).toContain('2 arii');
    expect(createI18n('ru').tp('lifemap.tplCount', 1)).toBe('1 сфера');
    expect(createI18n('ru').tp('lifemap.tplCount', 2)).toBe('2 сферы');
    expect(createI18n('ru').tp('lifemap.tplCount', 5)).toBe('5 сфер');
    expect(createI18n('uk').tp('lifemap.tplCount', 5)).toBe('5 сфер');
  });
});

describe('Intl formatters', () => {
  it('formats short durations with per-locale units', () => {
    expect(createI18n('en').fmtDur(25)).toBe('25m');
    expect(createI18n('en').fmtDur(60)).toBe('1h');
    expect(createI18n('en').fmtDur(135)).toBe('2h 15m');
    expect(createI18n('ro').fmtDur(135)).toBe('2h 15min');
    expect(createI18n('ru').fmtDur(60)).toBe('1 ч');
    expect(createI18n('ru').fmtDur(135)).toBe('2 ч 15 мин');
    expect(createI18n('de').fmtDur(135)).toBe('2 Std. 15 Min.');
  });

  it('uses 12h clock for en and 24h otherwise', () => {
    expect(createI18n('en').fmtClock(540)).toContain('AM');
    expect(createI18n('en').fmtClock(810)).toContain('PM');
    expect(createI18n('de').fmtClock(540)).toBe('09:00');
    expect(createI18n('ro').fmtClock(810)).toBe('13:30');
  });

  it('formats day keys per locale and passes junk through', () => {
    const enDate = createI18n('en').fmtDayKey('2026-9-17');
    expect(enDate).toContain('17');
    expect(enDate).toContain('Sep');
    expect(createI18n('ro').fmtDayKey('2026-9-17')).toContain('17');
    expect(createI18n('en').fmtDayKey('junk')).toBe('junk');
  });
});

describe('locale persistence', () => {
  it('round-trips through local storage and rejects junk', () => {
    expect(saveLocale('ro')).toBe(true);
    expect(loadLocale()).toBe('ro');
    expect(saveLocale('en')).toBe(true);
    expect(loadLocale()).toBe('en');
    expect(isLocale('xx')).toBe(false);
    expect(isLocale('ro')).toBe(true);
  });
});
