interface Props {
  /** 0–100. */
  value: number;
  label: string;
}

/** Mono progress bar (V1 prototype). */
export default function MonoProgress({ value, label }: Props) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      className="mono-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
