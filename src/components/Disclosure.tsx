import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  hint?: string;
  defaultOpen: boolean;
  children: ReactNode;
}

/**
 * Progressive disclosure (Roadmap Faza 2): power features stay one tap away.
 * Children stack as full-width rows (one under the other) — never side-by-side
 * narrow columns.
 */
export default function Disclosure({ title, hint, defaultOpen, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="md:col-span-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="press flex w-full items-center gap-3 border-t border-line/60 pt-6 text-left"
      >
        <span
          aria-hidden
          className={`shrink-0 font-mono text-[13px] text-sage transition-transform duration-200 ${
            open ? 'rotate-90' : ''
          }`}
        >
          ▸
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[19px] font-bold tracking-tight text-cream">
            {title}
          </span>
          {hint && <span className="mt-1.5 block text-[15px] leading-snug text-sage">{hint}</span>}
        </span>
      </button>
      {open && (
        <div className="mt-5 flex min-w-0 flex-col gap-5 [&>*]:min-w-0 [&>*]:w-full">
          {children}
        </div>
      )}
    </div>
  );
}
