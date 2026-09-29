import type { ReactNode } from 'react';

interface Props {
  /** 0–100, clamped and rounded. */
  value: number;
  /** Diameter in px. */
  size?: number;
  stroke?: number;
  /** Accessible name, e.g. "Today: 3 of 5 done (60%)". */
  label: string;
  tone?: 'accent' | 'fg';
  /** Centered content, e.g. "60%". */
  children?: ReactNode;
}

/** Mono progress ring (SVG). Not `.mono-ring` — that is the Focus timer. */
export default function MonoRing({
  value,
  size = 64,
  stroke = 6,
  label,
  tone = 'accent',
  children,
}: Props) {
  const v = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  return (
    <div
      className="mono-pring"
      role="img"
      aria-label={label}
      data-tone={tone}
      data-value={v}
      style={{ width: size, height: size }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="mono-pring-track" cx={mid} cy={mid} r={r} strokeWidth={stroke} />
        {v > 0 ? (
          <circle
            className="mono-pring-bar"
            cx={mid}
            cy={mid}
            r={r}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v / 100)}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        ) : null}
      </svg>
      {children != null ? <span className="mono-pring-center">{children}</span> : null}
    </div>
  );
}
