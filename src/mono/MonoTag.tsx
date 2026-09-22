import type { ReactNode } from 'react';

type Tone = 'plain' | 'accent' | 'ink';

const CLASSES: Record<Tone, string> = {
  plain: 'mono-tag',
  accent: 'mono-tag mono-tag-accent',
  ink: 'mono-tag mono-tag-ink',
};

/** Mono tag (V1 prototype). */
export default function MonoTag({
  tone = 'plain',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return <span className={CLASSES[tone]}>{children}</span>;
}
