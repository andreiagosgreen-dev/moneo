import type { KeyboardEvent, ReactNode } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import { MUSCLES, fitKey, type Muscle } from '../lib/fitness/library';

export type HeatLevel = 0 | 1 | 2 | 3;

type Shape =
  | { e: [number, number, number, number] }
  | { r: [number, number, number, number, number] }
  | { d: string };

/* Anatomical front/back human figures on a 100×190 grid each; the back figure is
 * drawn 120 units to the right. Sculpted muscle paths mirror across x = 50. */
const FRONT: Partial<Record<Muscle, Shape[]>> = {
  shoulders: [
    { d: 'M33 30 C23 31 18 38 19 47 C22 48 28 45 33 38 Z' },
    { d: 'M67 30 C77 31 82 38 81 47 C78 48 72 45 67 38 Z' },
  ],
  chest: [
    { d: 'M33 33 L49 34 L49 51 C41 53 33 49 31 41 Z' },
    { d: 'M67 33 L51 34 L51 51 C59 53 67 49 69 41 Z' },
  ],
  biceps: [
    { d: 'M20 48 C17 54 17 62 20 67 C24 67 27 61 27 52 Z' },
    { d: 'M80 48 C83 54 83 62 80 67 C76 67 73 61 73 52 Z' },
  ],
  forearms: [
    { d: 'M18 69 C14 75 14 86 17 94 L22 93 C24 85 25 76 24 69 Z' },
    { d: 'M82 69 C86 75 86 86 83 94 L78 93 C76 85 75 76 76 69 Z' },
  ],
  abs: [
    { r: [42.5, 53, 6.5, 9, 2.2] },
    { r: [51, 53, 6.5, 9, 2.2] },
    { r: [42.5, 64, 6.5, 9, 2.2] },
    { r: [51, 64, 6.5, 9, 2.2] },
    { r: [43, 75, 6, 10, 2.2] },
    { r: [51, 75, 6, 10, 2.2] },
  ],
  obliques: [
    { d: 'M33 52 C32 63 34 75 39 85 L41.5 84 L41.5 54 Z' },
    { d: 'M67 52 C68 63 66 75 61 85 L58.5 84 L58.5 54 Z' },
  ],
  quads: [
    { d: 'M34 94 C30 108 31 124 36 135 L43 135 C45 123 45 107 43 94 Z' },
    { d: 'M44 98 C44 112 44 126 47 134 C49 127 49 112 47 98 Z' },
    { d: 'M66 94 C70 108 69 124 64 135 L57 135 C55 123 55 107 57 94 Z' },
    { d: 'M56 98 C56 112 56 126 53 134 C51 127 51 112 53 98 Z' },
  ],
  adductors: [
    { d: 'M44 93 L49 93 L48 117 L44.5 112 Z' },
    { d: 'M56 93 L51 93 L52 117 L55.5 112 Z' },
  ],
  calves: [
    { d: 'M35 142 C31 151 32 163 37 173 L43 173 C45 162 45 150 42 142 Z' },
    { d: 'M65 142 C69 151 68 163 63 173 L57 173 C55 162 55 150 58 142 Z' },
  ],
};

const BACK: Partial<Record<Muscle, Shape[]>> = {
  traps: [{ d: 'M50 24 L65 31 L59 46 L50 54 L41 46 L35 31 Z' }],
  shoulders: [
    { d: 'M34 30 C24 31 19 38 20 46 C24 47 29 44 34 38 Z' },
    { d: 'M66 30 C76 31 81 38 80 46 C76 47 71 44 66 38 Z' },
  ],
  lats: [
    { d: 'M33 43 C30 56 33 70 40 80 L48 72 L48 48 Z' },
    { d: 'M67 43 C70 56 67 70 60 80 L52 72 L52 48 Z' },
  ],
  triceps: [
    { d: 'M20 47 C17 54 17 62 20 67 C25 66 27 60 27 51 Z' },
    { d: 'M80 47 C83 54 83 62 80 67 C75 66 73 60 73 51 Z' },
  ],
  forearms: [
    { d: 'M18 69 C14 75 14 86 17 94 L22 93 C24 85 25 76 24 69 Z' },
    { d: 'M82 69 C86 75 86 86 83 94 L78 93 C76 85 75 76 76 69 Z' },
  ],
  lowerBack: [{ d: 'M42 71 L49 71 L49 87 L40 85 Z' }, { d: 'M58 71 L51 71 L51 87 L60 85 Z' }],
  glutes: [
    { d: 'M35 86 C31 93 32 103 41 106 L49 104 L49 87 Z' },
    { d: 'M65 86 C69 93 68 103 59 106 L51 104 L51 87 Z' },
  ],
  hamstrings: [
    { d: 'M34 107 C32 118 33 129 37 137 L46 137 C48 128 48 117 46 107 Z' },
    { d: 'M66 107 C68 118 67 129 63 137 L54 137 C52 128 52 117 54 107 Z' },
  ],
  calves: [
    { d: 'M35 142 C31 151 32 163 37 173 L44 173 C46 162 46 150 43 142 Z' },
    { d: 'M65 142 C69 151 68 163 63 173 L56 173 C54 162 54 150 57 142 Z' },
  ],
};

function Silhouette() {
  return (
    <g className="mono-bmap-base">
      {/* Holographic biometric scanner reticle & axis */}
      <line className="mono-bmap-axis" x1={50} y1={2} x2={50} y2={186} />
      <circle className="mono-bmap-ring" cx={50} cy={62} r={44} />
      {/* Sculpted anatomical human silhouette */}
      <path d="M50 4 C44 4 40 9 40 15 C40 20 43 24 45 25 L44 29 L32 30 C22 31 17 38 17 48 C15 55 16 63 17 68 C13 75 13 86 16 95 L13 102 C13 105 18 106 21 101 L23 93 C26 84 26 74 26 68 L28 52 L31 52 C31 64 33 76 35 86 C31 97 30 119 35 137 C31 148 31 162 36 175 L33 182 C33 185 43 185 44 181 L44 174 C46 163 46 150 44 137 L48 116 L50 105 L52 116 L56 137 C54 150 54 163 56 174 L56 181 C57 185 67 185 67 182 L64 175 C69 162 69 148 65 137 C70 119 69 97 65 86 C67 76 69 64 69 52 L72 52 L74 68 C74 74 74 84 77 93 L79 101 C82 106 87 105 87 102 L84 95 C87 86 87 75 83 68 C84 63 85 55 83 48 C83 38 78 31 68 30 L56 29 L55 25 C57 24 60 20 60 15 C60 9 56 4 50 4 Z" />
      {/* Animated horizontal biometric laser scan line */}
      <line className="mono-bmap-scan" x1={12} y1={40} x2={88} y2={40} />
    </g>
  );
}

const draw = (s: Shape, key: number): ReactNode =>
  'e' in s ? (
    <ellipse key={key} cx={s.e[0]} cy={s.e[1]} rx={s.e[2]} ry={s.e[3]} />
  ) : 'r' in s ? (
    <rect key={key} x={s.r[0]} y={s.r[1]} width={s.r[2]} height={s.r[3]} rx={s.r[4]} />
  ) : (
    <path key={key} d={s.d} />
  );

interface Props {
  levels: Partial<Record<Muscle, HeatLevel>>;
  selected?: Muscle | null;
  /** Makes each muscle a toggle button; omit for a read-only picture. */
  onPick?: (m: Muscle) => void;
  /** Accessible name of the whole map. */
  label: string;
  className?: string;
}

/** Front + back anatomical body map; muscles filled by heat level. */
export default function MonoBodyMap({ levels, selected, onPick, label, className }: Props) {
  const { t } = useI18n();
  const seen = new Set<Muscle>();
  const lvText = (lv: HeatLevel) => t(`fit.map.lv${lv}` as 'fit.map.lv0');

  const group = (m: Muscle, shapes: Shape[]) => {
    const lv = levels[m] ?? 0;
    if (!onPick) {
      return (
        <g key={m} className="mono-bmap-m" data-lv={lv} data-muscle={m}>
          {shapes.map(draw)}
        </g>
      );
    }
    const first = !seen.has(m);
    seen.add(m);
    const pick = () => onPick(m);
    const onKey = (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick();
      }
    };
    return (
      <g
        key={m}
        className="mono-bmap-m is-btn"
        data-lv={lv}
        data-muscle={m}
        role={first ? 'button' : undefined}
        tabIndex={first ? 0 : -1}
        aria-hidden={first ? undefined : true}
        aria-label={first ? `${t(fitKey.muscle(m))}: ${lvText(lv)}` : undefined}
        aria-pressed={first ? selected === m : undefined}
        onClick={pick}
        onKeyDown={first ? onKey : undefined}
      >
        {shapes.map(draw)}
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 220 190"
      role="img"
      aria-label={label}
      className={className ? `mono-bmap ${className}` : 'mono-bmap'}
    >
      <g>
        <Silhouette />
        {MUSCLES.map((m) => (FRONT[m] ? group(m, FRONT[m]!) : null))}
      </g>
      <g transform="translate(120 0)">
        <Silhouette />
        {MUSCLES.map((m) => (BACK[m] ? group(m, BACK[m]!) : null))}
      </g>
    </svg>
  );
}
