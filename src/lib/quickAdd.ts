/* Natural-language quick add: "gym tomorrow 7:00 !1 30 min" → date, time,
 * priority and duration, in the current language plus English. Pure. */
import type { Locale } from './i18n/types';
import type { TaskPriority } from './tasks';
import { daysInMonth, noonPlusDays } from './dayKeys';
import { QUICK_VOCAB, type QuickVocab } from './quickAddVocab';

export type QuickTokenKind = 'date' | 'time' | 'priority' | 'duration';

export interface QuickAdd {
  /** Input minus recognised tokens, whitespace collapsed; '' if nothing is left. */
  title: string;
  /** Local noon of the day, or the exact local time when a time was given. */
  dueAt: number | null;
  hasTime: boolean;
  /** null = default (p2). */
  priority: TaskPriority | null;
  /** Clamped to 5..480, like `loadTasks`. */
  estimateMin: number | null;
  tokens: Array<{ kind: QuickTokenKind; raw: string }>;
}

export const QUICK_PRIORITY: Record<'1' | '2' | '3', TaskPriority> = {
  '1': 'p0',
  '2': 'p1',
  '3': 'p3',
};

type DateValue = { offset: number } | { next: number } | { ymd: [number, number, number] };

type Payload =
  | { kind: 'date'; date: DateValue }
  | { kind: 'time'; h: number; min: number }
  | { kind: 'priority'; priority: TaskPriority }
  | { kind: 'duration'; min: number };

interface Candidate {
  start: number;
  end: number;
  payload: Payload;
}

interface Matcher {
  re: RegExp;
  read: (m: RegExpExecArray) => Payload | null;
}

const B = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';

function normChar(ch: string): string {
  if (ch === '’' || ch === 'ʼ' || ch === '`') return "'";
  if (ch === '\u2010' || ch === '\u2011') return '-';
  if (ch === '\u00a0') return ' ';
  return ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function norm(s: string): string {
  let out = '';
  for (const ch of s) out += normChar(ch);
  return out;
}

/** Normalized text plus, per normalized char, the original [start, end). */
function normalizeWithMap(text: string): { s: string; from: number[]; to: number[] } {
  let s = '';
  const from: number[] = [];
  const to: number[] = [];
  let i = 0;
  for (const ch of text) {
    const n = normChar(ch);
    for (let k = 0; k < n.length; k++) {
      from.push(i);
      to.push(i + ch.length);
    }
    s += n;
    i += ch.length;
  }
  return { s, from, to };
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Alternation of phrases, longest first; spaces and hyphens match either. */
function alt(words: string[]): string {
  return [...new Set(words.map(norm))]
    .sort((a, b) => b.length - a.length)
    .map((w) => escape(w).replace(/[\s-]+/g, '[\\s-]+'))
    .join('|');
}

function hours(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function buildMatchers(v: QuickVocab): Matcher[] {
  const en = QUICK_VOCAB.en;
  const pick = <K extends keyof QuickVocab>(k: K) =>
    [...(v[k] as string[]), ...(en[k] as string[])] as string[];
  const minU = alt(pick('minuteUnits'));
  const hourU = alt(pick('hourUnits'));
  const at = alt(pick('at'));
  const re = (src: string) => new RegExp(src, 'gu');
  const offsetWords = (words: string[], offset: number): Matcher => ({
    re: re(`${B}(?:${alt(words)})${E}`),
    read: () => ({ kind: 'date', date: { offset } }),
  });

  const matchers: Matcher[] = [
    {
      re: re(`(?<![\\p{L}\\p{N}!])!([123])${E}`),
      read: (m) => ({ kind: 'priority', priority: QUICK_PRIORITY[m[1] as '1' | '2' | '3'] }),
    },
    offsetWords(pick('today'), 0),
    offsetWords(pick('tomorrow'), 1),
    offsetWords(pick('dayAfter'), 2),
    offsetWords(pick('nextWeek'), 7),
    {
      re: re(
        `${B}(?:${alt([...v.inDays.before, ...en.inDays.before])})\\s+(\\d{1,3})\\s+(?:${alt([
          ...v.inDays.after,
          ...en.inDays.after,
        ])})${E}`,
      ),
      read: (m) => ({ kind: 'date', date: { offset: Math.min(365, Number(m[1])) } }),
    },
    {
      re: re(`${B}next\\s+(${alt(en.weekdays.map((w) => w[0]))})${E}`),
      read: (m) => ({
        kind: 'date',
        date: { next: en.weekdays.findIndex((w) => norm(w[0]) === m[1]) + 7 },
      }),
    },
    {
      re: re(
        `(?<![\\p{L}\\p{N}.])(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{4}))?(?![\\p{L}\\p{N}]|\\.\\d)`,
      ),
      read: (m) => {
        const d = Number(m[1]);
        const mo = Number(m[2]);
        if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
        return { kind: 'date', date: { ymd: [m[3] ? Number(m[3]) : 0, mo, d] } };
      },
    },
    {
      re: re(
        `${B}(?:${at})\\s+(\\d{1,2})(?:[:h]([0-5]\\d)|\\s?(?:h|uhr)${E})?(?:\\s?(am|pm))?${E}(?!\\s*(?:${minU})${E})`,
      ),
      read: (m) => clock(m[1], m[2], m[3]),
    },
    {
      re: re(`${B}(\\d{1,2})(?::([0-5]\\d))?\\s?(am|pm)${E}`),
      read: (m) => clock(m[1], m[2], m[3]),
    },
    {
      re: re(`${B}(\\d{1,2}):([0-5]\\d)${E}`),
      read: (m) => clock(m[1], m[2]),
    },
    {
      re: re(
        `${B}(\\d{1,2}(?:[.,]\\d)?)\\s?(?:${hourU})(?:(\\d{1,2})|\\s?(\\d{1,2})\\s?(?:${minU}))?${E}`,
      ),
      read: (m) => ({
        kind: 'duration',
        min: Math.round(hours(m[1]) * 60) + Number(m[2] ?? m[3] ?? 0),
      }),
    },
    {
      re: re(`${B}(\\d{1,3})\\s?(?:${minU})${E}`),
      read: (m) => ({ kind: 'duration', min: Number(m[1]) }),
    },
  ];

  v.weekdays.forEach((forms, day) => {
    matchers.push({
      re: re(`${B}(?:${alt([...forms, ...en.weekdays[day]])})${E}`),
      read: () => ({ kind: 'date', date: { next: day } }),
    });
  });
  return matchers;
}

function clock(hRaw: string, minRaw?: string, ampm?: string): Payload | null {
  let h = Number(hRaw);
  const min = minRaw ? Number(minRaw) : 0;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return { kind: 'time', h, min };
}

const cache = new Map<Locale, Matcher[]>();

function matchersFor(locale: Locale): Matcher[] {
  let m = cache.get(locale);
  if (!m) {
    m = buildMatchers(QUICK_VOCAB[locale] ?? QUICK_VOCAB.en);
    cache.set(locale, m);
  }
  return m;
}

/** Calendar day for a date token, or null when it names an impossible date. */
function resolveDate(date: DateValue, now: number): [number, number, number] | null {
  const base = new Date(now);
  const y0 = base.getFullYear();
  const m0 = base.getMonth();
  const d0 = base.getDate();
  const shift = (days: number): [number, number, number] => {
    const d = new Date(y0, m0, d0 + days, 12);
    return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  };
  if ('offset' in date) return shift(date.offset);
  if ('next' in date) {
    const weekday = date.next % 7;
    let delta = (weekday - base.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    return shift(delta + (date.next >= 7 ? 7 : 0));
  }
  const [yGiven, m, d] = date.ymd;
  let y = yGiven || y0;
  if (!yGiven && new Date(y, m - 1, d, 23, 59, 59).getTime() < now) y += 1;
  if (d > daysInMonth(y, m)) return null;
  return [y, m, d];
}

export function parseQuickAdd(text: string, locale: Locale, now: number = Date.now()): QuickAdd {
  const { s, from, to } = normalizeWithMap(text);
  const found: Candidate[] = [];
  for (const { re, read } of matchersFor(locale)) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      const payload = read(m);
      if (payload) found.push({ start: m.index, end: m.index + m[0].length, payload });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Candidate[] = [];
  let cursor = 0;
  for (const c of found) {
    if (c.start < cursor) continue;
    if (c.payload.kind === 'date' && c.payload.date && 'ymd' in c.payload.date) {
      if (!resolveDate(c.payload.date, now)) continue;
    }
    kept.push(c);
    cursor = c.end;
  }

  let date: [number, number, number] | null = null;
  let time: { h: number; min: number } | null = null;
  let priority: TaskPriority | null = null;
  let estimateMin: number | null = null;
  const tokens: QuickAdd['tokens'] = [];
  const cut: Array<[number, number]> = [];
  for (const c of kept) {
    const p = c.payload;
    if (p.kind === 'date') date = resolveDate(p.date, now);
    else if (p.kind === 'time') time = { h: p.h, min: p.min };
    else if (p.kind === 'priority') priority = p.priority;
    else estimateMin = Math.min(480, Math.max(5, p.min));
    const start = from[c.start];
    const end = to[c.end - 1];
    tokens.push({ kind: p.kind, raw: text.slice(start, end) });
    cut.push([start, end]);
  }

  let title = '';
  let last = 0;
  for (const [a, b] of cut) {
    title += text.slice(last, a) + ' ';
    last = b;
  }
  title += text.slice(last);
  title = title
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:·–—-]+|[\s,;:·–—-]+$/g, '')
    .trim();

  let dueAt: number | null = null;
  if (date && time) {
    dueAt = new Date(date[0], date[1] - 1, date[2], time.h, time.min).getTime();
  } else if (date) {
    dueAt = new Date(date[0], date[1] - 1, date[2], 12).getTime();
  } else if (time) {
    const today = new Date(now);
    const at = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      time.h,
      time.min,
    ).getTime();
    if (at > now) dueAt = at;
    else {
      const t = new Date(noonPlusDays(now, 1));
      dueAt = new Date(t.getFullYear(), t.getMonth(), t.getDate(), time.h, time.min).getTime();
    }
  }

  return { title, dueAt, hasTime: time !== null, priority, estimateMin, tokens };
}

export function hasQuickTokens(q: QuickAdd): boolean {
  return q.tokens.length > 0;
}
