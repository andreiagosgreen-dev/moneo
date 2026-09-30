import type { KeyboardEvent, ReactNode } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import { MUSCLES, fitKey, type Muscle } from '../lib/fitness/library';

export type HeatLevel = 0 | 1 | 2 | 3;

type Shape =
  | { e: [number, number, number, number] }
  | { r: [number, number, number, number, number] }
  | { d: string };

/* Stylised front/back figures on a 100×190 grid each; the back figure is
 * drawn 120 units to the right. Mirrored pairs share one muscle group. */
const pair = (cx: number, cy: number, rx: number, ry: number): Shape[] => [
  { e: [cx, cy, rx, ry] },
  { e: [100 - cx, cy, rx, ry] },
];

const FRONT: Partial<Record<Muscle, Shape[]>> = {
  shoulders: pair(29, 40, 7.5, 7),
  chest: pair(42, 46, 9, 7.5),
  biceps: pair(24, 53, 4.8, 9),
  forearms: pair(20.5, 80, 4.5, 11),
  abs: [{ r: [43.5, 56, 13, 30, 4] }],
  obliques: pair(37, 70, 4, 11),
  quads: pair(40.5, 116, 7, 18),
  adductors: pair(47.5, 104, 2.8, 9),
  calves: pair(40.5, 156, 5, 13),
};

const BACK: Partial<Record<Muscle, Shape[]>> = {
  traps: [{ d: 'M50 26 L64 36 L50 52 L36 36 Z' }],
  shoulders: pair(29, 40, 7.5, 7),
  lats: [
    { d: 'M34 44 Q31 62 40 78 L47 70 L47 48 Z' },
    { d: 'M66 44 Q69 62 60 78 L53 70 L53 48 Z' },
  ],
  triceps: pair(24, 53, 4.8, 9),
  forearms: pair(20.5, 80, 4.5, 11),
  lowerBack: [{ r: [43, 70, 14, 16, 4] }],
  glutes: pair(42, 95, 8.5, 8),
  hamstrings: pair(40.5, 121, 6.8, 15),
  calves: pair(40.5, 154, 6, 13),
};

function Silhouette() {
  return (
    <g className="mono-bmap-base">
      <circle cx={50} cy={14} r={10} />
      <rect x={45} y={22} width={10} height={8} rx={3} />
      <rect x={31} y={29} width={38} height={62} rx={12} />
      <rect x={18} y={33} width={12} height={34} rx={6} />
      <rect x={70} y={33} width={12} height={34} rx={6} />
      <rect x={15} y={66} width={11} height={30} rx={5.5} />
      <rect x={74} y={66} width={11} height={30} rx={5.5} />
      <circle cx={20.5} cy={100} r={4.5} />
      <circle cx={79.5} cy={100} r={4.5} />
      <rect x={33} y={86} width={34} height={16} rx={7} />
      <rect x={33} y={96} width={16} height={44} rx={8} />
      <rect x={51} y={96} width={16} height={44} rx={8} />
      <rect x={34} y={138} width={13} height={40} rx={6.5} />
      <rect x={53} y={138} width={13} height={40} rx={6.5} />
      <ellipse cx={40.5} cy={181} rx={7} ry={3} />
      <ellipse cx={59.5} cy={181} rx={7} ry={3} />
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

/** Front + back body map; muscles filled by heat level (atmosphere accent). */
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
        aria-pressed={first ? selected === m : undefined}
        aria-label={
          first ? t('fit.map.aria', { muscle: t(fitKey.muscle(m)), level: lvText(lv) }) : undefined
        }
        onClick={pick}
        onKeyDown={first ? onKey : undefined}
      >
        {shapes.map(draw)}
      </g>
    );
  };

  const figure = (map: Partial<Record<Muscle, Shape[]>>) =>
    MUSCLES.filter((m) => map[m]).map((m) => group(m, map[m]!));

  return (
    <svg
      className={className ? `mono-bmap ${className}` : 'mono-bmap'}
      viewBox="0 0 220 198"
      role={onPick ? 'group' : 'img'}
      aria-label={label}
    >
      <g>
        <Silhouette />
        {figure(FRONT)}
        <text x={50} y={196} className="mono-bmap-cap">
          {t('fit.map.front')}
        </text>
      </g>
      <g transform="translate(120 0)">
        <Silhouette />
        {figure(BACK)}
        <text x={50} y={196} className="mono-bmap-cap">
          {t('fit.map.back')}
        </text>
      </g>
    </svg>
  );
}
