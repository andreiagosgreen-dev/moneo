import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'light' | 'ghost' | 'ink-ghost';

const CLASSES: Record<Variant, string> = {
  primary: 'mono-btn mono-btn-primary',
  light: 'mono-btn mono-btn-light',
  ghost: 'mono-btn mono-btn-ghost',
  'ink-ghost': 'mono-btn mono-btn-ink-ghost',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
}

/** Mono button (V1 prototype). 48px target, focus-visible ring. */
export default function MonoBtn({ variant = 'primary', block = false, children, ...rest }: Props) {
  return (
    <button {...rest} className={`${CLASSES[variant]}${block ? ' mono-btn-block' : ''}`}>
      {children}
    </button>
  );
}
