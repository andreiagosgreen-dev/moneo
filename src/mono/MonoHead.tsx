interface Props {
  eyebrow?: string;
  title: string;
  /** One-line “what this screen is for”. */
  sub?: string;
}

/** Mono page head: mono eyebrow + display title (V1 prototype). */
export default function MonoHead({ eyebrow, title, sub }: Props) {
  return (
    <div className="mono-page-head">
      {eyebrow ? <p className="mono-eyebrow">{eyebrow}</p> : null}
      <h1 className="mono-h1">{title}</h1>
      {sub ? <p className="mono-page-sub">{sub}</p> : null}
    </div>
  );
}
