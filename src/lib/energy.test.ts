import { describe, expect, it } from 'vitest';

import {
  energyAdvice,
  hourlyAverage,
  loadEnergyLog,
  logEnergy,
  peakHours,
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
});
