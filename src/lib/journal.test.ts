import { describe, expect, it } from 'vitest';

import {
  JOURNAL_PROMPTS,
  SESSION_REFLECTION_PROMPTS,
  WEEKLY_REFLECTION_PROMPTS,
  appendSessionReflection,
  loadJournal,
  loadTimeOff,
  moodAverage,
  promptForDay,
  promptForSession,
  recentEntries,
  saveJournal,
  saveTimeOff,
  toggleTimeOff,
  upsertEntry,
  weeklySummary,
} from './journal';

const NOW = new Date(2026, 8, 16, 12, 0).getTime();

describe('journal', () => {
  it('rotates deterministic daily prompts', () => {
    expect(JOURNAL_PROMPTS.length).toBeGreaterThanOrEqual(7);
    expect(WEEKLY_REFLECTION_PROMPTS).toHaveLength(3);
    expect(promptForDay(NOW)).toBe(promptForDay(NOW));
    expect(promptForDay(NOW)).not.toBe(promptForDay(NOW + 3 * 24 * 3600_000));
  });

  it('upserts entries and removes emptied husks', () => {
    let journal = upsertEntry({}, '2026-9-16', {
      mood: 4,
      gratitude: ['  coffee  ', '', 'sun'],
      text: 'Good day.',
    });
    expect(journal['2026-9-16'].mood).toBe(4);
    expect(journal['2026-9-16'].gratitude).toEqual(['coffee', 'sun']);
    journal = upsertEntry(journal, '2026-9-16', { mood: null, gratitude: [], text: '   ' });
    expect(journal['2026-9-16']).toBeUndefined();
    expect(loadJournal()).toEqual({});
  });

  it('rejects invalid moods on load', () => {
    expect(
      moodAverage(
        {
          '2026-9-16': {
            dayKey: '2026-9-16',
            mood: 9 as never,
            gratitude: [],
            text: 'x',
            updatedAt: 1,
          },
        },
        NOW,
        7,
      ),
    ).toBeNull();
  });

  it('averages mood over the trailing window', () => {
    const journal = upsertEntry(
      upsertEntry({}, '2026-9-16', { mood: 5, gratitude: [], text: '' }),
      '2026-9-15',
      {
        mood: 3,
        gratitude: [],
        text: '',
      },
    );
    expect(moodAverage(journal, NOW, 7)).toBe(4);
    expect(moodAverage({}, NOW, 7)).toBeNull();
  });

  it('lists recent entries newest-first and persists', () => {
    let journal = upsertEntry({}, '2026-9-14', { mood: 2, gratitude: [], text: 'meh' });
    journal = upsertEntry(journal, '2026-9-16', { mood: 5, gratitude: [], text: 'great' });
    expect(recentEntries(journal, 7).map((e) => e.dayKey)).toEqual(['2026-9-16', '2026-9-14']);
    expect(saveJournal(journal)).toBe(true);
    expect(Object.keys(loadJournal()).sort()).toEqual(['2026-9-14', '2026-9-16']);
  });

  it('summarizes the week from measured history', () => {
    const history = [
      { at: NOW - 3600_000, min: 25 },
      { at: NOW - 2 * 3600_000, min: 50 },
      { at: NOW - 10 * 24 * 3600_000, min: 999 },
    ];
    const journal = upsertEntry({}, '2026-9-16', { mood: 4, gratitude: [], text: '' });
    const summary = weeklySummary(history, journal, NOW);
    expect(summary.minutes).toBe(75);
    expect(summary.sessions).toBe(2);
    expect(summary.daysActive).toBe(1);
    expect(summary.mood).toBe(4);
  });
});

describe('post-session reflection (Faza 24)', () => {
  it('rotates a deterministic prompt by minute', () => {
    const p = promptForSession(NOW);
    expect(SESSION_REFLECTION_PROMPTS).toContain(p);
    expect(promptForSession(NOW)).toBe(p); // stable for the same timestamp
  });

  it('appends a bullet to the day, accumulating across sessions', () => {
    let journal = appendSessionReflection({}, '2026-9-16', 'Shipped the login flow');
    expect(journal['2026-9-16'].text).toBe('• Shipped the login flow');
    journal = appendSessionReflection(journal, '2026-9-16', 'Fixed a nasty bug');
    expect(journal['2026-9-16'].text).toBe(
      '• Shipped the login flow\n• Fixed a nasty bug',
    );
  });

  it('is a no-op for blank reflections and leaves other days untouched', () => {
    const journal = { '2026-9-15': { dayKey: '2026-9-15', gratitude: [], text: 'x', updatedAt: 1 } };
    expect(appendSessionReflection(journal, '2026-9-16', '   ')).toBe(journal);
  });
});

describe('time off', () => {
  it('toggles day keys sorted, deduped and capped', () => {
    expect(loadTimeOff()).toEqual([]);
    const added = toggleTimeOff([], '2026-12-24');
    expect(added).toEqual(['2026-12-24']);
    expect(toggleTimeOff(added, '2026-12-24')).toEqual([]);
    expect(saveTimeOff(['2026-12-24', '2026-12-31'])).toBe(true);
    expect(loadTimeOff()).toEqual(['2026-12-24', '2026-12-31']);
  });
});
