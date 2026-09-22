import { useState } from 'react';

interface Props {
  title: string;
  hint?: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}

/**
 * Progressive disclosure section (Roadmap Faza 2): power features stay one
 * tap away instead of crowding first-run screens. Plain section header —
 * deliberately NOT a card, so cards never nest. Instant toggle, respects
 * reduced-motion by construction.
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
          <span className="block font-display text-[17px] font-bold tracking-tight text-cream">
            {title}
          </span>
          {hint && <span className="mt-1 block text-[13px] text-sage">{hint}</span>}
        </span>
      </button>
      {open && (
        <div className="mt-5 grid min-w-0 items-start gap-6 md:grid-cols-2 [&>*]:min-w-0">
          {children}
        </div>
      )}
    </div>
  );
}
