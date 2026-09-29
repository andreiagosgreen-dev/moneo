interface Props {
  /** 0–100. */
  value: number;
  label: string;
  tone?: 'fg' | 'accent';
  size?: 'md' | 'sm';
}

/** Mono progress bar (V1 prototype). */
export default function MonoProgress({ value, label, tone = 'fg', size = 'md' }: Props) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      className="mono-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      data-tone={tone === 'fg' ? undefined : tone}
      data-size={size === 'md' ? undefined : size}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
