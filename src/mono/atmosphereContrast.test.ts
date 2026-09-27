import { describe, expect, it } from 'vitest';
import { ATMOSPHERES } from './atmosphere';

// Vitest runs in Node; project tsc only loads vite/client types.
// @ts-expect-error — node:fs has no ambient types under vite/client-only tsconfig
import { readFileSync } from 'node:fs';

/** Relative luminance (sRGB → WCAG). */
function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = Number.parseInt(full, 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

type AtmTokens = {
  bg: string;
  surface: string;
  fg: string;
  fg2: string;
  muted: string;
  accent: string;
  on: string;
  raised?: string;
};

function parseAtmosphereTokens(css: string): Map<string, AtmTokens> {
  const re = /\.atm-root\[data-atmosphere='([^']+)'\]\s*\{([^}]+)\}/g;
  const out = new Map<string, AtmTokens>();
  for (const m of css.matchAll(re)) {
    const id = m[1]!;
    const body = m[2]!;
    const get = (key: string): string | undefined => {
      const mm = body.match(new RegExp(`--${key}:\\s*([^;]+);`));
      return mm?.[1]?.trim();
    };
    const bg = get('mono-bg');
    const surface = get('mono-surface');
    const fg = get('mono-fg');
    const fg2 = get('mono-fg-2');
    const muted = get('mono-muted');
    const accent = get('mono-accent');
    const on = get('atm-on');
    if (!bg || !surface || !fg || !fg2 || !muted || !accent || !on) continue;
    if (![bg, surface, fg, fg2, muted, accent, on].every((v) => v.startsWith('#'))) continue;
    const raisedRaw = get('mono-raised');
    out.set(id, {
      bg,
      surface,
      fg,
      fg2,
      muted,
      accent,
      on,
      raised: raisedRaw?.startsWith('#') ? raisedRaw : undefined,
    });
  }
  return out;
}

const css = readFileSync('src/mono/mono.css', 'utf8');
const tokens = parseAtmosphereTokens(css);

describe('atmosphere contrast', () => {
  it('defines token blocks for every atmosphere id', () => {
    expect(css.length).toBeGreaterThan(0);
    expect(tokens.size).toBe(ATMOSPHERES.length);
    for (const id of ATMOSPHERES) {
      expect(tokens.has(id), `missing CSS tokens for ${id}`).toBe(true);
    }
  });

  it('keeps body / muted / accent text readable (WCAG-ish AA)', () => {
    const failures: string[] = [];
    for (const [id, t] of tokens) {
      const raised = t.raised ?? t.surface;
      const checks: Array<[string, number, number]> = [
        ['fg/bg', contrastRatio(t.fg, t.bg), 4.5],
        ['fg2/bg', contrastRatio(t.fg2, t.bg), 4.5],
        ['muted/bg', contrastRatio(t.muted, t.bg), 4.5],
        ['fg/surface', contrastRatio(t.fg, t.surface), 4.5],
        ['muted/surface', contrastRatio(t.muted, t.surface), 4.5],
        ['fg/raised', contrastRatio(t.fg, raised), 4.5],
        ['muted/raised', contrastRatio(t.muted, raised), 4.5],
        ['on/accent', contrastRatio(t.on, t.accent), 4.5],
        ['accent/bg', contrastRatio(t.accent, t.bg), 3],
        ['accent/surface', contrastRatio(t.accent, t.surface), 3],
        ['chip fg2/bg', contrastRatio(t.fg2, t.bg), 4.5],
        ['chip muted/surface', contrastRatio(t.muted, t.surface), 4.5],
      ];
      for (const [name, ratio, min] of checks) {
        if (ratio < min) {
          failures.push(`${id} ${name} ${ratio.toFixed(2)} < ${min}`);
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
