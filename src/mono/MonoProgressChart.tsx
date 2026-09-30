import { useMemo } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { ProgressPoint } from '../lib/fitness/records';

interface Props {
  points: ProgressPoint[];
  /** Accessible summary of the whole series. */
  label: string;
  format: (v: number) => string;
}

const W = 320;
const H = 120;
const PAD = 12;

/** Best value per workout as a line; the latest point is highlighted. */
export default function MonoProgressChart({ points, label, format }: Props) {
  const { tag } = useI18n();
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }),
    [tag],
  );
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - PAD * 2);
  const path = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <figure className="mono-fit-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <line className="mono-fit-chart-grid" x1={PAD} x2={W - PAD} y1={y(hi)} y2={y(hi)} />
        <line className="mono-fit-chart-grid" x1={PAD} x2={W - PAD} y1={y(lo)} y2={y(lo)} />
        <polyline className="mono-fit-chart-line" points={path} />
        {points.map((p, i) => (
          <circle
            key={i}
            className={
              i === points.length - 1 ? 'mono-fit-chart-dot is-last' : 'mono-fit-chart-dot'
            }
            cx={x(i)}
            cy={y(p.value)}
            r={i === points.length - 1 ? 4 : 2.5}
          />
        ))}
      </svg>
      <figcaption className="mono-fit-chart-cap mono-meta mono-fit-small" aria-hidden="true">
        <span>{dateFmt.format(points[0].at)}</span>
        <span>
          {format(lo)} – {format(hi)}
        </span>
        <span>
          {dateFmt.format(last.at)} · {format(last.value)}
        </span>
      </figcaption>
    </figure>
  );
}
