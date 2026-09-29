import { describe, expect, it } from 'vitest';
import { hasQuickTokens, parseQuickAdd } from './quickAdd';
import type { Locale } from './i18n/types';

/** Wednesday 30 September 2026, 10:00 local. */
const NOW = new Date(2026, 8, 30, 10, 0).getTime();
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

const parse = (text: string, locale: Locale = 'en', now = NOW) => parseQuickAdd(text, locale, now);

describe('parseQuickAdd — one phrase per language with every token kind', () => {
  const cases: Array<[Locale, string, string]> = [
    ['en', 'Gym tomorrow 7:00 !1 30 min', 'Gym'],
    ['ro', 'sală mâine 7:00 !1 30 min', 'sală'],
    ['ru', 'Спортзал завтра 7:00 !1 30 мин', 'Спортзал'],
    ['uk', 'Спортзал завтра о 7 !1 30 хв', 'Спортзал'],
    ['de', 'Fitness morgen um 7 !1 30 Min', 'Fitness'],
    ['fr', 'Sport demain à 7h !1 30 min', 'Sport'],
    ['es', 'Gimnasio mañana a las 7 !1 30 min', 'Gimnasio'],
    ['it', 'Palestra domani alle 7 !1 30 min', 'Palestra'],
  ];
  it.each(cases)('%s: %s', (locale, text, title) => {
    const q = parse(text, locale);
    expect(q.title).toBe(title);
    expect(q.dueAt).toBe(at(2026, 10, 1, 7, 0));
    expect(q.hasTime).toBe(true);
    expect(q.priority).toBe('p0');
    expect(q.estimateMin).toBe(30);
    expect(q.tokens.map((t) => t.kind).sort()).toEqual(['date', 'duration', 'priority', 'time']);
  });
});

describe('parseQuickAdd — weekdays, times and priorities', () => {
  const cases: Array<[Locale, string, string, number]> = [
    ['en', 'Report friday at 9am !2', 'Report', at(2026, 10, 2, 9)],
    ['ro', 'raport vineri la 9 !2', 'raport', at(2026, 10, 2, 9)],
    ['ru', 'Отчёт в пятницу в 9 !2', 'Отчёт', at(2026, 10, 2, 9)],
    ['uk', 'Звіт у п’ятницю 9:30 !2', 'Звіт', at(2026, 10, 2, 9, 30)],
    ['de', 'Bericht am Freitag 9:00 !2', 'Bericht', at(2026, 10, 2, 9)],
    ['fr', 'Rapport vendredi à 9h30 !2', 'Rapport', at(2026, 10, 2, 9, 30)],
    ['es', 'Informe el viernes 9:00 !2', 'Informe', at(2026, 10, 2, 9)],
    ['it', 'Relazione venerdì 9:00 !2', 'Relazione', at(2026, 10, 2, 9)],
  ];
  it.each(cases)('%s: %s', (locale, text, title, due) => {
    const q = parse(text, locale);
    expect(q.title).toBe(title);
    expect(q.dueAt).toBe(due);
    expect(q.hasTime).toBe(true);
    expect(q.priority).toBe('p1');
  });
});

describe('parseQuickAdd — relative days and durations', () => {
  const cases: Array<[Locale, string, string, number, number]> = [
    ['en', 'Call dentist in 3 days 1h30', 'Call dentist', at(2026, 10, 3), 90],
    ['ro', 'citește 20 de pagini poimâine 1h30', 'citește 20 de pagini', at(2026, 10, 2), 90],
    ['ru', 'Позвонить через 3 дня 1,5ч', 'Позвонить', at(2026, 10, 3), 90],
    ['uk', 'Подзвонити через 2 дні 2 год', 'Подзвонити', at(2026, 10, 2), 120],
    ['de', 'Arzt übermorgen 1,5 Std', 'Arzt', at(2026, 10, 2), 90],
    ['fr', 'Appeler après-demain 1h', 'Appeler', at(2026, 10, 2), 60],
    ['es', 'Llamar pasado mañana 2 horas', 'Llamar', at(2026, 10, 2), 120],
    ['it', 'Chiamare tra 3 giorni 1 ora', 'Chiamare', at(2026, 10, 3), 60],
  ];
  it.each(cases)('%s: %s', (locale, text, title, due, min) => {
    const q = parse(text, locale);
    expect(q.title).toBe(title);
    expect(q.dueAt).toBe(due);
    expect(q.hasTime).toBe(false);
    expect(q.priority).toBeNull();
    expect(q.estimateMin).toBe(min);
  });

  it('understands "next week" in every language', () => {
    const phrases: Array<[Locale, string]> = [
      ['en', 'Review next week'],
      ['ro', 'Revizuire săptămâna viitoare'],
      ['ru', 'Обзор на следующей неделе'],
      ['uk', 'Огляд наступного тижня'],
      ['de', 'Review nächste Woche'],
      ['fr', 'Bilan la semaine prochaine'],
      ['es', 'Repaso la próxima semana'],
      ['it', 'Revisione la prossima settimana'],
    ];
    for (const [locale, text] of phrases) {
      expect(parse(text, locale).dueAt, `${locale}: ${text}`).toBe(at(2026, 10, 7));
    }
  });
});

describe('parseQuickAdd — rules and edge cases', () => {
  it('matches without diacritics and falls back to English words', () => {
    expect(parse('sala maine', 'ro').dueAt).toBe(at(2026, 10, 1));
    expect(parse('llamar manana', 'es').dueAt).toBe(at(2026, 10, 1));
    expect(parse('bericht uebermorgen', 'de').dueAt).toBe(at(2026, 10, 2));
    expect(parse('relazione venerdi', 'it').dueAt).toBe(at(2026, 10, 2));
    expect(parse('sală tomorrow', 'ro').dueAt).toBe(at(2026, 10, 1));
  });

  it('accepts the documented ambiguities (DE "morgen", ES "mañana") as tomorrow', () => {
    expect(parse('Laufen morgen', 'de').dueAt).toBe(at(2026, 10, 1));
    expect(parse('Correr mañana', 'es').dueAt).toBe(at(2026, 10, 1));
  });

  it('only takes whole words', () => {
    expect(hasQuickTokens(parse('Proiect bijoi', 'ro'))).toBe(false);
    expect(parse('Joi prezentare', 'ro').dueAt).toBe(at(2026, 10, 1));
    expect(hasQuickTokens(parse('wow!1 great'))).toBe(false);
  });

  it('never picks today for a weekday name; EN "next <weekday>" adds a week', () => {
    expect(parse('Team sync wednesday').dueAt).toBe(at(2026, 10, 7));
    expect(parse('Plan trip next friday').dueAt).toBe(at(2026, 10, 9));
  });

  it('reads day-first numeric dates and rolls past ones into next year', () => {
    expect(parse('Pay rent 5.10').dueAt).toBe(at(2026, 10, 5));
    expect(parse('Taxes 15.3').dueAt).toBe(at(2027, 3, 15));
    expect(parse('Trip 1.6.2027').dueAt).toBe(at(2027, 6, 1));
    const bad = parse('Party 31.2');
    expect(bad.dueAt).toBeNull();
    expect(bad.title).toBe('Party 31.2');
  });

  it('places a time without a date today if still ahead, else tomorrow', () => {
    expect(parse('standup 11:30').dueAt).toBe(at(2026, 9, 30, 11, 30));
    expect(parse('standup 9:00').dueAt).toBe(at(2026, 10, 1, 9, 0));
    expect(parse('dinner 7pm').dueAt).toBe(at(2026, 9, 30, 19, 0));
  });

  it('rejects impossible times', () => {
    expect(hasQuickTokens(parse('Call 24:00'))).toBe(false);
    expect(hasQuickTokens(parse('Call 7:75'))).toBe(false);
  });

  it('maps !1/!2/!3 and keeps only the last priority', () => {
    expect(parse('a !1').priority).toBe('p0');
    expect(parse('a !2').priority).toBe('p1');
    expect(parse('a !3').priority).toBe('p3');
    expect(parse('a !1 b !3').priority).toBe('p3');
  });

  it('needs a unit for a duration; "at" + hour is a time, not a duration', () => {
    const pages = parse('read 20 pages');
    expect(hasQuickTokens(pages)).toBe(false);
    expect(pages.title).toBe('read 20 pages');
    expect(hasQuickTokens(parse('Capitolul 2', 'ro'))).toBe(false);
    const run = parse('alergare la 20 min', 'ro');
    expect(run.hasTime).toBe(false);
    expect(run.estimateMin).toBe(20);
    const fr = parse('Cours à 7h', 'fr');
    expect(fr.hasTime).toBe(true);
    expect(fr.estimateMin).toBeNull();
    expect(parse('Deep work 7h').estimateMin).toBe(420);
  });

  it('clamps durations to 5..480 minutes', () => {
    expect(parse('x 2 min').estimateMin).toBe(5);
    expect(parse('x 10h').estimateMin).toBe(480);
  });

  it('leaves an empty title when only tokens were typed', () => {
    const q = parse('tomorrow 7:00');
    expect(q.title).toBe('');
    expect(hasQuickTokens(q)).toBe(true);
  });

  it('keeps plain text untouched', () => {
    const q = parse('Call mom');
    expect(hasQuickTokens(q)).toBe(false);
    expect(q).toMatchObject({ title: 'Call mom', dueAt: null, priority: null, estimateMin: null });
  });

  it('builds due dates from local calendar parts across a DST change', () => {
    const beforeDst = new Date(2026, 9, 24, 10, 0).getTime();
    expect(parse('Hike tomorrow 8:00', 'en', beforeDst)).toMatchObject({
      dueAt: new Date(2026, 9, 25, 8, 0).getTime(),
    });
  });
});
