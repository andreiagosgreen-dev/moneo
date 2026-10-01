import type { ReactNode } from 'react';

/* Line-art for empty states (64×64) and glyphs for badges/templates (24×24).
 * Strokes use currentColor; `.mono-art-a` picks up the atmosphere accent. */

export type ArtName = 'chart' | 'folder' | 'target' | 'graph' | 'sprout' | 'calendar';

const ART: Record<ArtName, ReactNode> = {
  chart: (
    <>
      <path d="M10 52h44M14 52V14" />
      <rect x="20" y="36" width="7" height="16" rx="2" />
      <rect x="31" y="28" width="7" height="24" rx="2" />
      <rect x="42" y="20" width="7" height="32" rx="2" />
      <path className="mono-art-a" d="M18 30l10-8 9 5 12-12" />
      <circle className="mono-art-a mono-art-fill" cx="49" cy="15" r="2.5" />
    </>
  ),
  folder: (
    <>
      <path d="M8 20a4 4 0 0 1 4-4h11l5 5h24a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" />
      <path d="M8 28h48" />
      <path className="mono-art-a" d="M32 34v12M26 40h12" />
    </>
  ),
  target: (
    <>
      <circle cx="30" cy="34" r="20" />
      <circle cx="30" cy="34" r="12" />
      <circle className="mono-art-a mono-art-fill" cx="30" cy="34" r="3.5" />
      <path className="mono-art-a" d="M30 34L50 14M44 12l6 2 2 6" />
    </>
  ),
  graph: (
    <>
      <path d="M20 20l24 6M20 20l-2 24M44 26l-26 18M44 26l4 22M18 44l30 4" />
      <circle cx="20" cy="20" r="5" />
      <circle cx="18" cy="44" r="5" />
      <circle cx="48" cy="48" r="5" />
      <circle className="mono-art-a" cx="44" cy="26" r="6" />
      <circle className="mono-art-a mono-art-fill" cx="44" cy="26" r="2" />
    </>
  ),
  sprout: (
    <>
      <path d="M20 42h24l-3 12H23z" />
      <path d="M32 42V26" />
      <path className="mono-art-a" d="M32 30c0-8 6-13 14-13 0 8-6 13-14 13z" />
      <path d="M32 34c0-6-5-10-11-10 0 6 5 10 11 10z" />
    </>
  ),
  calendar: (
    <>
      <rect x="10" y="14" width="44" height="40" rx="6" />
      <path d="M10 24h44M22 9v9M42 9v9" />
      <path d="M19 33h4M30 33h4M41 33h4M19 43h4M30 43h4" />
      <path className="mono-art-a" d="M39 43l3 3 6-7" />
    </>
  ),
};

/** Empty-state illustration. Decorative — the surrounding copy carries the meaning. */
export function MonoArt({ name }: { name: ArtName }) {
  return (
    <svg className="mono-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {ART[name]}
    </svg>
  );
}

export type GlyphName =
  | 'flag'
  | 'clock'
  | 'flame'
  | 'folderCheck'
  | 'checks'
  | 'rank1'
  | 'rank2'
  | 'rank3'
  | 'cap'
  | 'run'
  | 'box'
  | 'book'
  | 'target'
  | 'globe'
  | 'briefcase'
  | 'sparkle'
  | 'hourglass'
  | 'moon'
  | 'coin'
  | 'leaf'
  | 'phoneOff'
  | 'apple'
  | 'heart'
  | 'pen'
  | 'rocket'
  | 'sun';

const GLYPH: Record<GlyphName, ReactNode> = {
  flag: <path d="M6 21V4M6 4h11l-2 4 2 4H6" />,
  clock: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </>
  ),
  flame: (
    <path d="M12 21c-4 0-6-3-6-6 0-4 3-5 3-9 3 1 5 4 5 7 1-1 2-2 2-4 2 2 2 4 2 6 0 3-2 6-6 6z" />
  ),
  folderCheck: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 13l2 2 4-4" />
    </>
  ),
  checks: (
    <>
      <path d="M3 7l2 2 4-4M3 17l2 2 4-4" />
      <path d="M13 7h8M13 17h8" />
    </>
  ),
  rank1: <path d="M6 15l6-5 6 5" />,
  rank2: <path d="M6 12l6-5 6 5M6 18l6-5 6 5" />,
  rank3: <path d="M6 9l6-5 6 5M6 14l6-5 6 5M6 19l6-5 6 5" />,
  cap: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6" />
    </>
  ),
  run: (
    <>
      <circle cx="15" cy="4.5" r="2" />
      <path d="M8 21l3-6 3 2v5M6 11l4-3 4 1 3 4 3 1M11 15l1-5" />
    </>
  ),
  box: (
    <>
      <path d="M3 8l9-4 9 4v9l-9 4-9-4z" />
      <path d="M3 8l9 4 9-4M12 12v9" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 21a2 2 0 0 1 2-2h13v2M9 7h6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      <path d="M19 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </>
  ),
  hourglass: <path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" />,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-14 15-15 0 10-6 15-14 15z" />
      <path d="M5 19c3-4 6-7 10-9" />
    </>
  ),
  phoneOff: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M11 18h2M3 3l18 18" />
    </>
  ),
  apple: (
    <>
      <path d="M12 7c-2-1.5-6-1-7 3s1 10 4 10c1 0 2-.5 3-.5s2 .5 3 .5c3 0 5-6 4-10s-5-4.5-7-3z" />
      <path d="M12 7c0-2 1-4 3-4" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  pen: (
    <>
      <path d="M5 19l1-4L16 5l3 3L9 18z" />
      <path d="M14 7l3 3" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 15l-3-3c1-5 4-8 10-9-1 6-4 9-9 10z" />
      <path d="M9 12l-3 1-2 3 4-1M12 15l-1 3-3 2 1-4" />
      <circle cx="15" cy="9" r="1" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </>
  ),
};

/** Small line glyph (badges, template cards). Decorative. */
export function MonoGlyph({ name }: { name: GlyphName }) {
  return (
    <svg className="mono-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {GLYPH[name]}
    </svg>
  );
}
