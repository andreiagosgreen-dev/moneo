import type { CSSProperties, ReactNode } from 'react';

interface Props {
  ink?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

/** Mono card (V1 prototype). `ink` = the memorised dark session block. */
export default function MonoCard({ ink = false, style, children }: Props) {
  return (
    <div className={`mono-card${ink ? ' mono-card-ink' : ''}`} style={style}>
      {children}
    </div>
  );
}
