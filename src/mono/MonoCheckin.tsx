import { useRef, useState, type KeyboardEvent } from 'react';
import MonoCard from './MonoCard';
import { dailyCheckinFor, logDailyCheckin, DAILY_SCALE, type EnergyEntry } from '../lib/energy';
import { dayKeyInTz } from '../lib/timezone';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n';

interface Props {
  entries: EnergyEntry[];
  onChange: (entries: EnergyEntry[]) => void;
  timezone: string;
  now?: number;
}

const LEVELS = Array.from({ length: DAILY_SCALE }, (_, i) => i + 1);

interface ScaleProps {
  label: string;
  value: number | null;
  ariaKey: TKey;
  lowKey: TKey;
  highKey: TKey;
  onPick: (n: number) => void;
}

function Scale({ label, value, ariaKey, lowKey, highKey, onPick }: ScaleProps) {
  const { t, fmtNum } = useI18n();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusIdx = value ? value - 1 : 0;

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = (idx + delta + DAILY_SCALE) % DAILY_SCALE;
    refs.current[next]?.focus();
  };

  return (
    <div className="mono-checkin-scale">
      <p className="mono-h3" style={{ marginBottom: 8 }}>
        {label}
      </p>
      <div className="mono-checkin-row" role="radiogroup" aria-label={label}>
        {LEVELS.map((n, idx) => (
          <button
            key={n}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t(ariaKey, { n: fmtNum(n) })}
            tabIndex={idx === focusIdx ? 0 : -1}
            className="mono-checkin-btn"
            onClick={() => onPick(n)}
            onKeyDown={(e) => onKey(e, idx)}
          >
            {fmtNum(n)}
          </button>
        ))}
      </div>
      <div className="mono-checkin-ends mono-meta" aria-hidden="true">
        <span>{t(lowKey)}</span>
        <span>{t(highKey)}</span>
      </div>
    </div>
  );
}

/** One-tap daily energy + mood (1–5), stored in the existing energy log. */
export default function MonoCheckin({ entries, onChange, timezone, now = Date.now() }: Props) {
  const { t, fmtNum } = useI18n();
  const dayKey = dayKeyInTz(now, timezone);
  const { energy, mood } = dailyCheckinFor(entries, dayKey);
  const [editing, setEditing] = useState(false);

  const pickEnergy = (n: number) => onChange(logDailyCheckin(entries, dayKey, { energy: n }));
  const pickMood = (n: number) => {
    onChange(logDailyCheckin(entries, dayKey, { mood: n }));
    setEditing(false);
  };

  const showEnergy = energy === null || editing;
  const showMood = energy !== null && (mood === null || editing);
  const summary =
    energy === null || editing
      ? null
      : mood !== null
        ? t('mono.checkin.summary', { e: fmtNum(energy), m: fmtNum(mood) })
        : t('mono.checkin.summaryEnergy', { e: fmtNum(energy) });

  return (
    <section className="mono-sec mono-pad" aria-label={t('mono.checkin.title')}>
      <MonoCard>
        <p className="mono-eyebrow" style={{ marginBottom: 10 }}>
          {t('mono.checkin.title')}
        </p>
        {summary ? (
          <div className="mono-checkin-summary" data-testid="checkin-summary">
            <span className="mono-h3">{summary}</span>
            <button
              type="button"
              className="mono-link mono-checkin-change"
              onClick={() => setEditing(true)}
            >
              {t('mono.checkin.change')}
            </button>
          </div>
        ) : null}
        {showEnergy ? (
          <Scale
            label={t('mono.checkin.energy')}
            value={energy}
            ariaKey="mono.checkin.energyN"
            lowKey="mono.checkin.low"
            highKey="mono.checkin.high"
            onPick={pickEnergy}
          />
        ) : null}
        {showMood ? (
          <div style={{ marginTop: 12 }}>
            <Scale
              label={t('mono.checkin.mood')}
              value={mood}
              ariaKey="mono.checkin.moodN"
              lowKey="mono.checkin.moodLow"
              highKey="mono.checkin.moodHigh"
              onPick={pickMood}
            />
          </div>
        ) : null}
      </MonoCard>
    </section>
  );
}
