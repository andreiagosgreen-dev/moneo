import type { PoseId } from '../lib/fitness/library';

/* Stick-figure poses drawn on a 48×48 grid: filled head, stroked limbs,
 * optional props (plates, dumbbells) as circles. Floor line at y≈44. */
interface Pose {
  head: [number, number];
  lines: string[];
  dots?: [number, number, number][];
}

const POSES: Record<PoseId, Pose> = {
  stand: { head: [24, 8], lines: ['24,12 24,27', '20,43 24,27 28,43', '18,23 24,15 30,23'] },
  jack: { head: [24, 8], lines: ['24,12 24,27', '15,43 24,27 33,43', '13,5 24,15 35,5'] },
  squat: { head: [20, 15], lines: ['22,19 28,31', '28,31 18,32 20,43', '22,21 11,22'] },
  lunge: {
    head: [24, 8],
    lines: ['24,12 24,26', '24,26 14,32 14,43', '24,26 30,41 38,43', '20,23 24,15 28,23'],
  },
  pushup: { head: [9, 26], lines: ['13,30 42,42', '13,30 13,43'] },
  plank: { head: [9, 31], lines: ['13,34 42,42', '13,34 13,42 20,42'] },
  climber: { head: [8, 25], lines: ['12,28 28,33 42,42', '28,33 20,37 23,41', '12,28 12,43'] },
  bridge: { head: [8, 40], lines: ['12,41 26,31 35,30 37,43', '12,41 22,42'] },
  superman: { head: [9, 35], lines: ['13,38 32,40 43,36', '13,38 3,32'] },
  crunch: { head: [13, 31], lines: ['16,35 26,41', '26,41 34,32 40,43', '16,35 22,39'] },
  dip: {
    head: [24, 14],
    lines: [
      '30,30 42,30',
      '30,30 30,43',
      '42,18 42,43',
      '25,18 25,32',
      '25,20 32,24 31,30',
      '25,32 14,33 12,43',
    ],
  },
  bench: {
    head: [10, 30],
    lines: [
      '7,34 37,34',
      '11,34 11,43',
      '33,34 33,43',
      '13,32 30,32',
      '30,32 37,33 38,43',
      '18,32 18,22',
    ],
    dots: [[18, 19, 3.2]],
  },
  deadlift: {
    head: [12, 19],
    lines: ['28,26 16,22', '28,26 26,34 28,43', '16,22 18,35'],
    dots: [[18, 38.5, 4.5]],
  },
  pulldown: {
    head: [24, 15],
    lines: [
      '8,6 40,6',
      '24,6 24,2',
      '13,7 17,16 24,21 31,16 35,7',
      '24,19 24,33',
      '24,33 34,33 34,43',
      '17,35 31,35',
    ],
  },
  row: {
    head: [8, 21],
    lines: [
      '5,32 25,32',
      '7,32 7,43',
      '23,32 23,43',
      '11,23 30,23',
      '12,24 12,31',
      '30,23 33,33 33,43',
      '30,23 24,31',
      '27,23 27,29',
    ],
    dots: [[27, 31.5, 2.4]],
  },
  press: {
    head: [24, 14],
    lines: ['8,6 40,6', '14,7 16,15 24,19 32,15 34,7', '24,18 24,30', '20,43 24,30 28,43'],
    dots: [
      [9, 6, 3],
      [39, 6, 3],
    ],
  },
  legpress: {
    head: [10, 20],
    lines: ['12,24 18,36', '18,36 28,27 36,30', '33,22 40,36', '8,40 22,40', '13,27 18,34'],
  },
  curl: {
    head: [24, 8],
    lines: ['24,12 24,27', '20,43 24,27 28,43', '24,15 18,26', '24,15 29,24 33,18'],
    dots: [
      [18, 28, 2.2],
      [33, 15.5, 2.2],
    ],
  },
  dog: { head: [14, 32], lines: ['8,43 24,16 40,43'] },
  warrior: {
    head: [24, 8],
    lines: ['24,12 24,26', '24,26 12,31 12,43', '24,26 38,43', '8,17 40,17'],
  },
  tree: {
    head: [24, 11],
    lines: ['24,15 24,28', '24,28 24,43', '24,28 32,33 24,36', '24,17 18,10 24,3 30,10 24,17'],
  },
  cobra: { head: [10, 26], lines: ['22,41 42,42', '22,41 12,30', '13,31 15,42'] },
  child: { head: [12, 39], lines: ['20,42 36,42', '33,36 20,42', '33,36 17,38', '15,40 4,42'] },
  cat: { head: [9, 32], lines: ['12,28 23,22 34,28', '12,28 12,42', '34,28 34,42 42,42'] },
  triangle: {
    head: [11, 17],
    lines: ['10,43 24,28 38,43', '24,28 15,21', '15,21 8,30', '15,21 23,9'],
  },
  fold: { head: [27, 40], lines: ['20,24 20,43', '20,24 27,36', '27,36 24,43'] },
  seated: { head: [27, 27], lines: ['14,42 42,42', '14,41 24,30', '24,30 38,40'] },
  twist: {
    head: [24, 20],
    lines: ['24,24 24,41', '10,42 24,41', '24,41 32,31 34,42', '24,27 31,33', '24,27 17,38'],
  },
  lying: {
    head: [8, 40],
    lines: ['11,41 26,41', '26,41 31,30 39,34', '26,41 36,38 31,30', '14,41 29,32'],
  },
  shoulder: {
    head: [24, 8],
    lines: ['24,12 24,27', '20,43 24,27 28,43', '27,15 12,17', '21,15 19,22 23,18'],
  },
  chest: { head: [22, 8], lines: ['23,12 24,27', '24,27 22,43', '24,27 27,43', '23,15 30,26'] },
  neck: {
    head: [27, 10],
    lines: ['24,15 24,29', '20,43 24,29 28,43', '17,26 24,17 31,26', '20,3 24,1 28,3'],
  },
};

export default function MonoExerciseIcon({
  pose,
  size = 40,
  className,
}: {
  pose: PoseId;
  size?: number;
  className?: string;
}) {
  const p = POSES[pose] ?? POSES.stand;
  return (
    <svg
      className={className ? `mono-fit-icon ${className}` : 'mono-fit-icon'}
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1={3} y1={44.8} x2={45} y2={44.8} strokeWidth={1.4} opacity={0.35} />
      <circle cx={p.head[0]} cy={p.head[1]} r={3.7} fill="currentColor" stroke="none" />
      {p.lines.map((pts) => (
        <polyline key={pts} points={pts} />
      ))}
      {p.dots?.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}
