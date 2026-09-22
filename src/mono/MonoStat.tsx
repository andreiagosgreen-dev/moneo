interface Props {
  value: string;
  caption: string;
}

/** Mono stat tile (V1 prototype). Mono numerals. */
export default function MonoStat({ value, caption }: Props) {
  return (
    <div className="mono-stat">
      <div className="mono-stat-v">{value}</div>
      <div className="mono-stat-k">{caption}</div>
    </div>
  );
}
