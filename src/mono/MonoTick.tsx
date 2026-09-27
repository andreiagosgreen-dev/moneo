import { useState } from 'react';

interface Props {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

/** Mono checkbox (V1 prototype). Real button + role=checkbox, Space/Enter native. */
export default function MonoTick({ checked, onToggle, label }: Props) {
  // Pop only on a real check-off — never for rows that mount already done.
  const [pop, setPop] = useState(false);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        setPop(!checked);
        onToggle();
      }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setPop(false);
      }}
      className={pop ? 'mono-tick is-pop' : 'mono-tick'}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7" />
      </svg>
    </button>
  );
}
