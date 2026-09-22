import type { ReactNode } from 'react';

interface Props {
  art: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}

/** Mono empty state (V1 prototype). */
export default function MonoEmpty({ art, title, body, action }: Props) {
  return (
    <div className="mono-empty">
      <div className="mono-empty-art">{art}</div>
      <div className="mono-h3">{title}</div>
      <p className="mono-meta" style={{ maxWidth: '34ch' }}>
        {body}
      </p>
      {action}
    </div>
  );
}
