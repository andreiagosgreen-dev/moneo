import { describe, expect, it } from 'vitest';

import {
  breakAdvice,
  dailyCheckinFor,
  dailyCheckinId,
  logDailyCheckin,
  energyAdvice,
  energyMean,
  hourlyAverage,
  loadEnergyLog,
  logEnergy,
  peakHours,
  predictPeak,
  restAdvice,
  saveEnergyLog,
} from './energy';

const NOON = new Date(2026, 8, 16, 12, 0).getTime();

function at(hour: number, dayOffset = 0): number {
  const d = new Date(2026, 8, 16 + dayOffset, hour, 0, 0);
  return d.getTime();
}

describe('energy', () => {
  it('logs check-ins clamped 1-10', () => {
    expect(loadEnergyLog()).toEqual([]);
    let entries = logEnergy([], 9, at(9));
    entries = logEnergy(entries, 99, at(10));
    entries = logEnergy(entries, 0, at(11));
    expect(entries.map((e) => e.level)).toEqual([9, 10, 1]);
    expect(logEnergy(entries, Number.NaN, at(12))).toBe(entries);
  });

  it('averages per hour and finds peaks with repeat samples', () => {
    let entries = logEnergy([], 9, at(9));
    entries = logEnergy(entries, 8, at(9, -1));
    entries = logEnergy(entries, 3, at(15));
    entries = logEnergy(entries, 4, at(15, -1));
    entries = logEnergy(entries, 6, at(21, -1));
    entries = logEnergy(entries, 7, at(21, -2));
    const buckets = hourlyAverage(entries, NOON, 14);
    expect(buckets.find((b) => b.hour === 9)).toMatchObject({ avg: 8.5, samples: 2 });
    const peaks = peakHours(entries, NOON, 2);
    expect(peaks.map((p) => p.hour)).toEqual([9, 21]);
  });

  it('advises from measured peaks, asks for data otherwise', () => {
    expect(energyAdvice([], NOON)).toContain('~5 check-ins');
    let entries = logEnergy([], 9, at(9));
    entries = logEnergy(entries, 9, at(9, -1));
    entries = logEnergy(entries, 9, at(9, -2));
    entries = logEnergy(entries, 8, at(9, -3));
    entries = logEnergy(entries, 8, at(9, -4));
    entries = logEnergy(entries, 4, at(15));
    entries = logEnergy(entries, 4, at(15, -1));
    expect(energyAdvice(entries, NOON)).toContain('9:00');
    expect(saveEnergyLog(entries)).toBe(true);
    expect(loadEnergyLog()).toHaveLength(7);
  });

  it('predicts today from trailing peaks', () => {
    expect(predictPeak([], NOON)).toBeNull();
    let entries = logEnergy([], 9, at(9));
    entries = logEnergy(entries, 8, at(9, -1));
    expect(predictPeak(entries, NOON)).toMatchObject({ hour: 9 });
  });

  it('nudges a break after 100+ unbroken minutes', () => {
    const now = NOON;
    const history = [
      { at: now - 110 * 60_000, min: 50 },
      { at: now - 55 * 60_000, min: 55 },
    ];
    expect(breakAdvice(history, now)).toContain('10 minutes');
    expect(breakAdvice([], now)).toBeNull();
    const rested = [
      { at: now - 110 * 60_000, min: 50 },
      { at: now - 30 * 60_000, min: 20 },
    ];
    // 30-minute gap between sessions → rested
    expect(breakAdvice(rested, now)).toBeNull();
  });

  it('means trailing levels and advises rest after long runs', () => {
    const now = NOON;
    expect(energyMean([], now)).toBeNull();
    const entries = logEnergy(logEnergy([], 8, at(9)), 6, at(10));
    expect(energyMean(entries, now)).toBe(7);
    const sixDays = Array.from({ length: 6 }, (_, i) => ({
      at: now - i * 24 * 3600_000,
      min: 30,
    }));
    expect(restAdvice(sixDays, now)).toContain('day off');
    expect(restAdvice([], now)).toBeNull();
  });
});

describe('daily check-in', () => {
  it('creates one record per day and updates it in place', () => {
    let entries = logDailyCheckin([], '2026-9-16', { energy: 4 }, at(9));
    expect(entries).toEqual([{ id: 'daily-2026-9-16', at: at(9), level: 8, daily: true }]);
    entries = logDailyCheckin(entries, '2026-9-16', { mood: 5 }, at(10));
    entries = logDailyCheckin(entries, '2026-9-16', { energy: 2 }, at(11));
    expect(entries).toHaveLength(1);
    expect(dailyCheckinFor(entries, '2026-9-16')).toEqual({ energy: 2, mood: 5 });
    expect(dailyCheckinId('2026-9-16')).toBe('daily-2026-9-16');
  });

  it('needs energy before mood and clamps to 1-5', () => {
    const none = logDailyCheckin([], '2026-9-16', { mood: 3 });
    expect(none).toEqual([]);
    const entries = logDailyCheckin([], '2026-9-16', { energy: 9, mood: 0 }, at(9));
    expect(dailyCheckinFor(entries, '2026-9-16')).toEqual({ energy: 5, mood: 1 });
    expect(dailyCheckinFor(entries, '2026-9-17')).toEqual({ energy: null, mood: null });
  });

  it('keeps mood and daily through the loader', () => {
    const entries = logDailyCheckin([], '2026-9-16', { energy: 3, mood: 4 }, at(9));
    saveEnergyLog([...entries, { id: 'x', at: at(8), level: 7, mood: 9 }]);
    const loaded = loadEnergyLog();
    expect(loaded.find((e) => e.id === 'daily-2026-9-16')).toMatchObject({
      level: 6,
      mood: 4,
      daily: true,
    });
    expect(loaded.find((e) => e.id === 'x')).toMatchObject({ mood: 5 });
    expect(loaded.find((e) => e.id === 'x')?.daily).toBeUndefined();
    saveEnergyLog([]);
  });

  it('leaves hourly peaks to the hourly log', () => {
    let entries = logEnergy([], 5, at(9));
    entries = logEnergy(entries, 5, at(9, -1));
    entries = logDailyCheckin(entries, '2026-9-15', { energy: 5 }, at(20, -1));
    entries = logDailyCheckin(entries, '2026-9-14', { energy: 5 }, at(20, -2));
    expect(peakHours(entries, NOON, 3).map((p) => p.hour)).toEqual([9]);
    expect(energyMean(entries, NOON)).toBe(7.5);
  });
});
