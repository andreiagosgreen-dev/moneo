interface Props {
  eyebrow: string;
  title: string;
}

/** Mono page head: mono eyebrow + display title (V1 prototype). */
export default function MonoHead({ eyebrow, title }: Props) {
  return (
    <div className="mono-page-head">
      <p className="mono-eyebrow">{eyebrow}</p>
      <h1 className="mono-h1">{title}</h1>
    </div>
  );
}
