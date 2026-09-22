interface Props {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

/** Mono checkbox (V1 prototype). Real button + role=checkbox, Space/Enter native. */
export default function MonoTick({ checked, onToggle, label }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="mono-tick"
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7" />
      </svg>
    </button>
  );
}
