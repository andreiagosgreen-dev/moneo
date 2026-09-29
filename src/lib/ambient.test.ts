import { describe, expect, it } from 'vitest';
import {
  defaultAmbientFor,
  fillBrown,
  fillPink,
  fillWhite,
  isSilent,
  MAX_LAYERS,
  mulberry32,
  sanitizeLayers,
} from './ambient';

describe('ambient generators', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('noise buffers stay within [-1, 1] and are not silent', () => {
    for (const fill of [fillWhite, fillPink, fillBrown]) {
      const buf = new Float32Array(4096);
      fill(buf, mulberry32(3));
      let max = 0;
      for (const v of buf) max = Math.max(max, Math.abs(v));
      expect(max).toBeLessThanOrEqual(1);
      expect(max).toBeGreaterThan(0.1);
    }
  });

  it('brown noise is smoother than white noise', () => {
    const w = new Float32Array(4096);
    const br = new Float32Array(4096);
    fillWhite(w, mulberry32(5));
    fillBrown(br, mulberry32(5));
    const step = (b: Float32Array) => {
      let s = 0;
      for (let i = 1; i < b.length; i++) s += Math.abs(b[i] - b[i - 1]);
      return s / b.length;
    };
    expect(step(br)).toBeLessThan(step(w) / 4);
  });
});

describe('defaultAmbientFor', () => {
  it('sea atmospheres get the ocean, others rain', () => {
    expect(defaultAmbientFor('mare', false)).toBe('ocean');
    expect(defaultAmbientFor('tarm', true)).toBe('ocean');
    expect(defaultAmbientFor('ritual', false)).toBe('rain');
    expect(defaultAmbientFor('jar', true)).toBe('rain');
  });
});

describe('sanitizeLayers', () => {
  it('drops junk, duplicates and clamps volume', () => {
    expect(sanitizeLayers('x', true)).toEqual([]);
    expect(
      sanitizeLayers(
        [
          { id: 'rain', volume: 3 },
          { id: 'rain', volume: 0.2 },
          { id: 'nope' },
          null,
          { id: 'ocean' },
        ],
        true,
      ),
    ).toEqual([
      { id: 'rain', volume: 1 },
      { id: 'ocean', volume: 0.6 },
    ]);
  });

  it('Free keeps one free sound; Pro up to three', () => {
    const all = [
      { id: 'brown', volume: 0.5 },
      { id: 'white', volume: 0.5 },
      { id: 'rain', volume: 0.5 },
      { id: 'ocean', volume: 0.5 },
    ];
    expect(sanitizeLayers(all, false)).toEqual([{ id: 'white', volume: 0.5 }]);
    expect(sanitizeLayers(all, true)).toHaveLength(MAX_LAYERS);
  });

  it('isSilent', () => {
    expect(isSilent([])).toBe(true);
    expect(isSilent([{ id: 'rain', volume: 0 }])).toBe(true);
    expect(isSilent([{ id: 'rain', volume: 0.1 }])).toBe(false);
  });
});
