import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ICONS } from '../lib/icons';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  value?: string;
  onChange: (icon: string | null) => void;
}

const COLS = 6;

/** Icon trigger + 6-column popover grid; slot 0 clears the icon. */
export default function MonoIconPicker({ value, onChange }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const gridId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const cells = useRef<Array<HTMLButtonElement | null>>([]);
  const count = ICONS.length + 1;

  useEffect(() => {
    if (!open) return;
    const idx = value ? ICONS.indexOf(value) + 1 : 0;
    setFocus(idx > 0 ? idx : 0);
  }, [open, value]);

  useEffect(() => {
    if (open) cells.current[focus]?.focus();
  }, [open, focus]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const pick = (icon: string | null) => {
    onChange(icon);
    close();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLS,
      ArrowUp: -COLS,
    };
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key in moves) {
      e.preventDefault();
      setFocus((f) => Math.min(count - 1, Math.max(0, f + moves[e.key])));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocus(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocus(count - 1);
    }
  };

  return (
    <div className="mono-icon-picker">
      <button
        ref={trigger}
        type="button"
        className="mono-icon-trigger"
        aria-label={value ? t('mono.icon.current', { icon: value }) : t('mono.icon.label')}
        aria-expanded={open}
        aria-controls={gridId}
        onClick={() => setOpen((v) => !v)}
      >
        {value ? <span aria-hidden>{value}</span> : <span className="mono-icon-dot" aria-hidden />}
      </button>
      {open ? (
        <div
          id={gridId}
          className="mono-icon-grid"
          role="group"
          aria-label={t('mono.icon.label')}
          onKeyDown={onKey}
        >
          <button
            ref={(el) => {
              cells.current[0] = el;
            }}
            type="button"
            className="mono-icon-cell mono-icon-none"
            tabIndex={focus === 0 ? 0 : -1}
            aria-pressed={!value}
            onClick={() => pick(null)}
          >
            {t('mono.icon.none')}
          </button>
          {ICONS.map((icon, i) => (
            <button
              key={icon}
              ref={(el) => {
                cells.current[i + 1] = el;
              }}
              type="button"
              className="mono-icon-cell"
              tabIndex={focus === i + 1 ? 0 : -1}
              aria-label={t('mono.icon.pick', { n: i + 1 })}
              aria-pressed={value === icon}
              onClick={() => pick(icon)}
            >
              <span aria-hidden>{icon}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
