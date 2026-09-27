import { describe, expect, it } from 'vitest';
import { LIFETIME, makeBurst, rng, step } from './confetti';

describe('confetti physics', () => {
  it('rng is deterministic and in [0, 1)', () => {
    const a = rng(7);
    const b = rng(7);
    for (let i = 0; i < 50; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('bursts upward with the requested count and palette', () => {
    const pieces = makeBurst(30, 200, 300, ['#a', '#b'], rng(1));
    expect(pieces).toHaveLength(30);
    for (const p of pieces) {
      expect(p.vy).toBeLessThan(0);
      expect(['#a', '#b']).toContain(p.color);
      expect(p.life).toBe(1);
    }
  });

  it('uses a fallback color when the palette is empty', () => {
    expect(makeBurst(1, 0, 0, [], rng(1))[0].color).toBe('#888');
  });

  it('gravity pulls pieces down over time', () => {
    const [p] = makeBurst(1, 0, 0, ['#a'], rng(3));
    const later = step([p], 0.5)[0];
    expect(later.vy).toBeGreaterThan(p.vy);
  });

  it('every piece is gone after its lifetime', () => {
    let pieces = makeBurst(20, 0, 0, ['#a'], rng(9));
    for (let t = 0; t < LIFETIME + 0.1; t += 0.05) pieces = step(pieces, 0.05);
    expect(pieces).toEqual([]);
  });
});
