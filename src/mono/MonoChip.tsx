import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  ink?: boolean;
  children: ReactNode;
}

/** Mono pill chip (V1 prototype). Controlled via `pressed`. */
export default function MonoChip({ pressed = false, ink = false, children, ...rest }: Props) {
  return (
    <button {...rest} aria-pressed={pressed} className={`mono-chip${ink ? ' mono-chip-ink' : ''}`}>
      {children}
    </button>
  );
}
