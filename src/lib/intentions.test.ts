import { describe, expect, it } from 'vitest';
import type { Session } from './store';
import { loadHistory, saveHistory } from './store';
import { getTotalFocusedMinutes } from './growth';
import {
  INTENTION_MAX,
  getWeeklyTopIntentions,
  groupFocusByIntention,
  normalizeIntention,
  sanitizeIntention,
} from './intentions';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
};

const s = (min: number, intention?: string, at = day(0)): Session =>
  intention === undefined ? { at, min } : { at, min, intention };

describe('sanitizeIntention', () => {
  it('treats an empty intention as none', () => {
    expect(sanitizeIntention('')).toBeNull();
  });

  it('treats a whitespace-only intention as none', () => {
    expect(sanitizeIntention('   \t  ')).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeIntention('  Write thesis  ')).toBe('Write thesis');
  });

  it('accepts exactly the 80-character maximum', () => {
    const max = 'a'.repeat(INTENTION_MAX);
    expect(sanitizeIntention(max)).toBe(max);
  });

  it('truncates longer-than-maximum input to 80 characters', () => {
    expect(sanitizeIntention('a'.repeat(120))!.length).toBe(INTENTION_MAX);
  });
});

describe('round capture contract', () => {
  it('a captured intention is a snapshot — later draft edits cannot change it', () => {
    let draft = 'Write thesis';
    const captured = sanitizeIntention(draft);
    draft = 'Read research'; // user edits the draft mid-round
    expect(captured).toBe('Write thesis');
    expect(sanitizeIntention(draft)).toBe('Read research');
  });
});

describe('history validation and persistence', () => {
  it('an invalid stored intention type is ignored, not the whole entry', () => {
    localStorage.setItem('solanum:history', JSON.stringify([{ at: 1000, min: 25, intention: 42 }]));
    expect(loadHistory()).toEqual([{ at: 1000, min: 25 }]);
  });

  it('legacy history without intention remains fully valid', () => {
    localStorage.setItem('solanum:history', JSON.stringify([{ at: 1000, min: 25 }]));
    expect(loadHistory()).toEqual([{ at: 1000, min: 25 }]);
  });

  it('new history with intention loads intact', () => {
    localStorage.setItem(
      'solanum:history',
      JSON.stringify([{ at: 1000, min: 25, intention: 'Write thesis' }]),
    );
    expect(loadHistory()).toEqual([{ at: 1000, min: 25, intention: 'Write thesis' }]);
  });

  it('intention survives a history persistence round-trip', () => {
    const entry: Session = { at: 5000, min: 50, intention: 'Deep work' };
    saveHistory([entry]);
    expect(loadHistory()).toEqual([entry]);
  });
});

describe('intention grouping', () => {
  it('groups the same normalized intention (case + whitespace)', () => {
    const groups = groupFocusByIntention([s(25, 'Thesis'), s(25, ' thesis '), s(25, 'THESIS')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].min).toBe(75);
  });

  it('keeps different intentions separate', () => {
    const groups = groupFocusByIntention([s(25, 'Thesis'), s(15, 'Email')]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.label).sort()).toEqual(['Email', 'Thesis']);
  });

  it('normalizes keys case-insensitively with collapsed whitespace', () => {
    expect(normalizeIntention(' Client   Work ')).toBe('client work');
    expect(normalizeIntention('   ')).toBeNull();
  });
});

describe('weekly intentional focus', () => {
  it('sums intentional minutes over the trailing 7 local days only', () => {
    const top = getWeeklyTopIntentions([
      s(25, 'Thesis', day(0)),
      s(30, 'thesis', day(3)),
      s(100, 'Thesis', day(8)), // outside the 7-day window
    ]);
    expect(top).toHaveLength(1);
    expect(top[0].min).toBe(55);
  });

  it('excludes sessions without intention from the ranking', () => {
    const top = getWeeklyTopIntentions([
      s(25, 'Thesis'),
      s(90), // no intention — never ranked
    ]);
    expect(top).toHaveLength(1);
    expect(top[0].label).toBe('Thesis');
  });
});

describe('growth independence', () => {
  it('growth totals are unchanged by the presence of intentions', () => {
    const withIntention = [
      { at: day(0), min: 25 },
      { at: day(0), min: 50, intention: 'Thesis' },
    ];
    const plain = [
      { at: day(0), min: 25 },
      { at: day(0), min: 50 },
    ];
    expect(getTotalFocusedMinutes(withIntention)).toBe(getTotalFocusedMinutes(plain));
  });
});
