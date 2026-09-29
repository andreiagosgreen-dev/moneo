import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'accent' | 'danger' | 'outline';

interface Props {
  tone?: PillTone;
  children: ReactNode;
  title?: string;
  /** Dimmed, never red (finished items). */
  done?: boolean;
}

/** Small non-interactive status pill (priority, due date). */
export default function MonoPill({ tone = 'neutral', children, title, done }: Props) {
  return (
    <span className={`mono-pill mono-pill-${tone}${done ? ' mono-pill-done' : ''}`} title={title}>
      {children}
    </span>
  );
}
