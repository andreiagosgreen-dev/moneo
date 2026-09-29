import type { Locale } from './i18n/types';

/**
 * Words the quick-add parser recognises, per language. Data, not UI copy:
 * lower-case, written with their usual diacritics (the parser strips marks
 * from both the vocabulary and the input). Weekday lists are indexed like
 * `Date#getDay()` (0 = Sunday) and may hold several forms, including a
 * preposition ("в пятницу") so the whole phrase leaves the title.
 */
export interface QuickVocab {
  today: string[];
  tomorrow: string[];
  dayAfter: string[];
  nextWeek: string[];
  weekdays: string[][];
  /** "in N days": the word before N, and the day words after it. */
  inDays: { before: string[]; after: string[] };
  /** Words that turn a bare hour into a time ("la 7", "at 7"). */
  at: string[];
  minuteUnits: string[];
  hourUnits: string[];
}

export const QUICK_VOCAB: Record<Locale, QuickVocab> = {
  en: {
    today: ['today', 'tonight'],
    tomorrow: ['tomorrow'],
    dayAfter: ['day after tomorrow'],
    nextWeek: ['next week'],
    weekdays: [
      ['sunday', 'on sunday'],
      ['monday', 'on monday'],
      ['tuesday', 'on tuesday'],
      ['wednesday', 'on wednesday'],
      ['thursday', 'on thursday'],
      ['friday', 'on friday'],
      ['saturday', 'on saturday'],
    ],
    inDays: { before: ['in'], after: ['days', 'day'] },
    at: ['at'],
    minuteUnits: ['m', 'min', 'mins', 'minute', 'minutes'],
    hourUnits: ['h', 'hr', 'hrs', 'hour', 'hours'],
  },
  ro: {
    today: ['azi', 'astăzi', 'diseară'],
    tomorrow: ['mâine'],
    dayAfter: ['poimâine'],
    nextWeek: ['săptămâna viitoare'],
    weekdays: [['duminică'], ['luni'], ['marți'], ['miercuri'], ['joi'], ['vineri'], ['sâmbătă']],
    inDays: { before: ['peste'], after: ['zile', 'zi'] },
    at: ['la ora', 'la'],
    minuteUnits: ['min', 'minut', 'minute'],
    hourUnits: ['h', 'oră', 'ore'],
  },
  ru: {
    today: ['сегодня'],
    tomorrow: ['завтра'],
    dayAfter: ['послезавтра'],
    nextWeek: ['на следующей неделе', 'следующей неделе'],
    weekdays: [
      ['воскресенье', 'в воскресенье'],
      ['понедельник', 'в понедельник'],
      ['вторник', 'во вторник'],
      ['среда', 'среду', 'в среду'],
      ['четверг', 'в четверг'],
      ['пятница', 'пятницу', 'в пятницу'],
      ['суббота', 'субботу', 'в субботу'],
    ],
    inDays: { before: ['через'], after: ['дней', 'дня', 'день'] },
    at: ['в'],
    minuteUnits: ['мин', 'минут', 'минуты', 'минута'],
    hourUnits: ['ч', 'час', 'часа', 'часов'],
  },
  uk: {
    today: ['сьогодні'],
    tomorrow: ['завтра'],
    dayAfter: ['післязавтра'],
    nextWeek: ['наступного тижня', 'на наступному тижні'],
    weekdays: [
      ['неділя', 'неділю', 'у неділю', 'в неділю'],
      ['понеділок', 'у понеділок', 'в понеділок'],
      ['вівторок', 'у вівторок', 'в вівторок'],
      ['середа', 'середу', 'у середу', 'в середу'],
      ['четвер', 'у четвер', 'в четвер'],
      ["п'ятниця", "п'ятницю", "у п'ятницю", "в п'ятницю", 'пятниця', 'пятницю'],
      ['субота', 'суботу', 'у суботу', 'в суботу'],
    ],
    inDays: { before: ['через'], after: ['днів', 'дні', 'день'] },
    at: ['о', 'об', 'в'],
    minuteUnits: ['хв', 'хвилин', 'хвилини', 'хвилина'],
    hourUnits: ['год', 'година', 'години', 'годин'],
  },
  de: {
    today: ['heute'],
    tomorrow: ['morgen'],
    dayAfter: ['übermorgen', 'uebermorgen'],
    nextWeek: ['nächste woche', 'naechste woche'],
    weekdays: [
      ['sonntag', 'am sonntag'],
      ['montag', 'am montag'],
      ['dienstag', 'am dienstag'],
      ['mittwoch', 'am mittwoch'],
      ['donnerstag', 'am donnerstag'],
      ['freitag', 'am freitag'],
      ['samstag', 'am samstag', 'sonnabend'],
    ],
    inDays: { before: ['in'], after: ['tagen', 'tag'] },
    at: ['um'],
    minuteUnits: ['min', 'minute', 'minuten'],
    hourUnits: ['h', 'std', 'stunde', 'stunden'],
  },
  fr: {
    today: ["aujourd'hui", 'ce soir'],
    tomorrow: ['demain'],
    dayAfter: ['après-demain'],
    nextWeek: ['la semaine prochaine', 'semaine prochaine'],
    weekdays: [
      ['dimanche'],
      ['lundi'],
      ['mardi'],
      ['mercredi'],
      ['jeudi'],
      ['vendredi'],
      ['samedi'],
    ],
    inDays: { before: ['dans'], after: ['jours', 'jour'] },
    at: ['à'],
    minuteUnits: ['min', 'minute', 'minutes'],
    hourUnits: ['h', 'heure', 'heures'],
  },
  es: {
    today: ['hoy', 'esta noche'],
    tomorrow: ['mañana'],
    dayAfter: ['pasado mañana'],
    nextWeek: ['la próxima semana', 'próxima semana', 'la semana que viene'],
    weekdays: [
      ['domingo', 'el domingo'],
      ['lunes', 'el lunes'],
      ['martes', 'el martes'],
      ['miércoles', 'el miércoles'],
      ['jueves', 'el jueves'],
      ['viernes', 'el viernes'],
      ['sábado', 'el sábado'],
    ],
    inDays: { before: ['en'], after: ['días', 'día'] },
    at: ['a las', 'a la'],
    minuteUnits: ['min', 'minuto', 'minutos'],
    hourUnits: ['h', 'hora', 'horas'],
  },
  it: {
    today: ['oggi', 'stasera'],
    tomorrow: ['domani'],
    dayAfter: ['dopodomani'],
    nextWeek: ['la prossima settimana', 'prossima settimana', 'settimana prossima'],
    weekdays: [
      ['domenica'],
      ['lunedì'],
      ['martedì'],
      ['mercoledì'],
      ['giovedì'],
      ['venerdì'],
      ['sabato'],
    ],
    inDays: { before: ['tra', 'fra'], after: ['giorni', 'giorno'] },
    at: ['alle ore', 'alle'],
    minuteUnits: ['min', 'minuto', 'minuti'],
    hourUnits: ['h', 'ora', 'ore'],
  },
};
