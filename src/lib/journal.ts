/* Journaling & reflection (Roadmap Phase 5.3) — daily prompts, mood,
 * gratitude and free reflection, keyed by local day. Weekly summaries are
 * derived from measured history. Pure functions; storage via STORAGE_KEYS.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { localDayKey } from './projects';
import { createI18n, type I18n } from './i18n';

/** Default English translator — keeps helpers usable without a provider. */
const EN_I18N = createI18n('en');

export type Mood = 1 | 2 | 3 | 4 | 5;

export const MOOD_LABELS: Record<Mood, string> = {
  1: 'Rough',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
};

/** Translation keys mirroring MOOD_LABELS (UI renders via t()). */
export const MOOD_KEYS: Record<Mood, string> = {
  1: 'life.mood.1',
  2: 'life.mood.2',
  3: 'life.mood.3',
  4: 'life.mood.4',
  5: 'life.mood.5',
};

export const JOURNAL_PROMPTS: string[] = [
  'What went well today?',
  'What did you avoid — and why?',
  'What are you grateful for right now?',
  'What drained your energy today?',
  'What would make tomorrow a win?',
  'What did you learn today?',
  'Who made your day better?',
];

export const WEEKLY_REFLECTION_PROMPTS: string[] = [
  'What moved the needle this week?',
  'Where did time leak?',
  'What will you do differently next week?',
];

/** Post-session reflection prompts (Faza 24) — short, session-scoped, not daily. */
export const SESSION_REFLECTION_PROMPTS: string[] = [
  'What did you just work on?',
  'How did that session go, in one sentence?',
  "What's the next small step?",
  'Anything worth remembering from this session?',
];
/** Translation keys mirroring the prompt lists, in the same order. */
export const JOURNAL_PROMPT_KEYS: string[] = [
  'life.prompt.0',
  'life.prompt.1',
  'life.prompt.2',
  'life.prompt.3',
  'life.prompt.4',
  'life.prompt.5',
  'life.prompt.6',
];

export const WEEKLY_PROMPT_KEYS: string[] = ['life.rprompt.0', 'life.rprompt.1', 'life.rprompt.2'];

export const MAX_GRATITUDE = 3;
export const MAX_ENTRY_LENGTH = 2000;

export interface JournalEntry {
  dayKey: string;
  mood?: Mood;
  gratitude: string[];
  text: string;
  updatedAt: number;
}

export type Journal = Record<string, JournalEntry>;

/** Deterministic daily prompt, rotating by day. Never throws. */
export function promptForDay(at: number = Date.now(), i18n: I18n = EN_I18N): string {
  const key = promptKeyForDay(at);
  const text = i18n.t(key as never);
  return text || JOURNAL_PROMPTS[0];
}

/** Frame id of the daily prompt — UI translates with its own translator. */
export function promptKeyForDay(at: number = Date.now()): string {
  const dayIndex = Math.floor(at / (24 * 60 * 60 * 1000));
  return JOURNAL_PROMPT_KEYS[
    ((dayIndex % JOURNAL_PROMPT_KEYS.length) + JOURNAL_PROMPT_KEYS.length) %
      JOURNAL_PROMPT_KEYS.length
  ];
}

/** Deterministic post-session prompt, rotating by minute so it varies session to session. */
export function promptForSession(at: number = Date.now()): string {
  const idx = Math.floor(at / 60000);
  const n = SESSION_REFLECTION_PROMPTS.length;
  return SESSION_REFLECTION_PROMPTS[((idx % n) + n) % n];
}

/**
 * Append a post-session reflection to a day's free-text entry as a bullet
 * line (a day's text is a single field; multiple sessions accumulate).
 * Pure. Never throws.
 */
export function appendSessionReflection(
  journal: Journal,
  dayKey: string,
  reflection: string,
): Journal {
  const trimmed = reflection.trim();
  if (!trimmed) return journal;
  const prevText = journal[dayKey]?.text ?? '';
  const bullet = `• ${trimmed.slice(0, 280)}`;
  const text = prevText.trim() ? `${prevText}\n${bullet}` : bullet;
  return upsertEntry(journal, dayKey, { text });
}

function isMood(v: unknown): v is Mood {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}

export function loadJournal(): Journal {
  const stored = read<Journal>(STORAGE_KEYS.journal);
  if (!stored || typeof stored !== 'object') return {};
  const clean: Journal = {};
  for (const [k, v] of Object.entries(stored)) {
    if (!v || typeof v !== 'object') continue;
    const gratitude = Array.isArray(v.gratitude)
      ? v.gratitude
          .filter((g) => typeof g === 'string' && g.trim())
          .map((g) => g.trim().slice(0, 120))
          .slice(0, MAX_GRATITUDE)
      : [];
    const text = typeof v.text === 'string' ? v.text.slice(0, MAX_ENTRY_LENGTH) : '';
    if (!isMood(v.mood) && gratitude.length === 0 && !text.trim()) continue;
    clean[k] = {
      dayKey: k,
      ...(isMood(v.mood) ? { mood: v.mood } : {}),
      gratitude,
      text,
      updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
    };
  }
  return clean;
}

export function saveJournal(journal: Journal): boolean {
  return write(STORAGE_KEYS.journal, journal);
}

export interface EntryPatch {
  mood?: Mood | null;
  gratitude?: string[];
  text?: string;
}

/**
 * Upsert a day's entry. Entries left fully empty are removed (no husks).
 * Pure. Never throws.
 */
export function upsertEntry(journal: Journal, dayKey: string, patch: EntryPatch): Journal {
  const prev = journal[dayKey];
  const mood = patch.mood !== undefined ? patch.mood : prev?.mood;
  const gratitude =
    patch.gratitude !== undefined
      ? patch.gratitude
          .filter((g) => typeof g === 'string' && g.trim())
          .map((g) => g.trim().slice(0, 120))
          .slice(0, MAX_GRATITUDE)
      : (prev?.gratitude ?? []);
  const text =
    patch.text !== undefined ? patch.text.slice(0, MAX_ENTRY_LENGTH) : (prev?.text ?? '');
  if (!isMood(mood) && gratitude.length === 0 && !text.trim()) {
    const next: Journal = { ...journal };
    delete next[dayKey];
    return next;
  }
  return {
    ...journal,
    [dayKey]: {
      dayKey,
      ...(isMood(mood) ? { mood } : {}),
      gratitude,
      text,
      updatedAt: Date.now(),
    },
  };
}

/** Average mood over the trailing window (null when no moods logged). */
export function moodAverage(journal: Journal, now: number = Date.now(), days = 7): number | null {
  const moods: number[] = [];
  for (let i = 0; i < Math.max(1, days); i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const entry = journal[localDayKey(d.getTime())];
    if (entry && isMood(entry.mood)) moods.push(entry.mood);
  }
  if (moods.length === 0) return null;
  return moods.reduce((a, b) => a + b, 0) / moods.length;
}

/** Newest-first entries, capped. */
export function recentEntries(journal: Journal, limit = 7): JournalEntry[] {
  return Object.values(journal)
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
    .slice(0, Math.max(1, limit));
}

export interface WeeklySummary {
  minutes: number;
  sessions: number;
  daysActive: number;
  mood: number | null;
}

/** Auto stats for the trailing 7 days to anchor the weekly reflection. */
export function weeklySummary(
  history: Array<{ at: number; min: number }>,
  journal: Journal,
  now: number = Date.now(),
): WeeklySummary {
  const start = now - 7 * 24 * 60 * 60 * 1000;
  const inWeek = history.filter((s) => typeof s.at === 'number' && s.at >= start && s.at <= now);
  const days = new Set(inWeek.map((s) => localDayKey(s.at)));
  return {
    minutes: inWeek.reduce((sum, s) => sum + (typeof s.min === 'number' ? s.min : 0), 0),
    sessions: inWeek.length,
    daysActive: days.size,
    mood: moodAverage(journal, now, 7),
  };
}

/* ---------------- days off / vacation (Roadmap 5.5) ---------------- */

/** Planned days off as local day keys ("YYYY-M-D"), capped at a year. */
export function loadTimeOff(): string[] {
  const stored = read<string[]>(STORAGE_KEYS.timeOff);
  if (!Array.isArray(stored)) return [];
  return Array.from(new Set(stored.filter((d) => typeof d === 'string')))
    .sort()
    .slice(-365);
}

export function saveTimeOff(days: string[]): boolean {
  const clean = Array.from(new Set(days.filter((d) => typeof d === 'string')))
    .sort()
    .slice(-365);
  return write(STORAGE_KEYS.timeOff, clean);
}

/** Toggle a day off. Pure. Never throws. */
export function toggleTimeOff(days: string[], dayKey: string): string[] {
  const set = new Set(days);
  if (set.has(dayKey)) set.delete(dayKey);
  else set.add(dayKey);
  return [...set].sort().slice(-365);
}
