import { useState } from 'react';
import MonoBtn from './MonoBtn';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import {
  CARDIO_KINDS,
  MAX_CARDIO_KM,
  MAX_CARDIO_MIN,
  cardioPace,
  newCardioEntry,
  paceClock,
  type CardioKind,
  type Pace,
} from '../lib/fitness/cardio';
import type { WorkoutEntry } from '../lib/fitness/workouts';

interface Props {
  onSave: (entry: WorkoutEntry) => void;
  onCancel: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** "YYYY-MM-DD" for a date input. */
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "YYYY-MM-DD" → the app's local day key "YYYY-M-D". */
const toDayKey = (iso: string) =>
  iso
    .split('-')
    .map((p) => String(Number(p)))
    .join('-');

const num = (v: string) => Number.parseFloat(v.replace(',', '.'));

export function paceText(
  t: (key: TKey, vars?: Record<string, string | number>) => string,
  fmtNum: (n: number) => string,
  pace: Pace,
): string {
  return pace.unit === 'kmh'
    ? t('fit.cardio.speed', { kmh: fmtNum(pace.kmh) })
    : t('fit.cardio.perKm', { time: paceClock(pace.sec) });
}

/** Log a run, walk, ride or hike after the fact: time, optional distance, day. */
export default function MonoCardioLog({ onSave, onCancel }: Props) {
  const { t, fmtNum } = useI18n();
  const today = isoDay(new Date());
  const [kind, setKind] = useState<CardioKind>('run');
  const [minutes, setMinutes] = useState('30');
  const [km, setKm] = useState('');
  const [day, setDay] = useState(today);
  const [error, setError] = useState(false);

  const mins = num(minutes);
  const dist = km.trim() ? num(km) : undefined;
  const pace =
    Number.isFinite(mins) && mins > 0 && dist !== undefined && Number.isFinite(dist)
      ? cardioPace(kind, mins * 60, dist)
      : undefined;

  const save = () => {
    const entry = newCardioEntry({
      kind,
      minutes: mins,
      km: dist !== undefined && Number.isFinite(dist) ? dist : undefined,
      dayKey: toDayKey(day || today),
      todayKey: toDayKey(today),
    });
    if (!entry) {
      setError(true);
      return;
    }
    onSave(entry);
  };

  return (
    <section
      className="mono-fit-builder"
      data-testid="fit-cardio-form"
      aria-labelledby="fit-c-title"
    >
      <button type="button" className="mono-link-btn mono-fit-back" onClick={onCancel}>
        ‹ {t('fit.b.cancel')}
      </button>
      <h2 className="mono-h2" id="fit-c-title">
        {t('fit.cardio.formTitle')}
      </h2>
      <div className="mono-fit-filters" role="group" aria-label={t('fit.cardio.kind')}>
        {CARDIO_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className="mono-chip"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {t(`fit.cardio.${k}` as TKey)}
          </button>
        ))}
      </div>
      <div className="mono-fit-inputs mono-fit-cardio-inputs">
        <label className="mono-fit-label">
          <span className="mono-meta">{t('fit.cardio.minutes')}</span>
          <input
            className="mono-field mono-field-sm"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_CARDIO_MIN}
            value={minutes}
            onChange={(e) => {
              setMinutes(e.target.value);
              setError(false);
            }}
          />
        </label>
        <label className="mono-fit-label">
          <span className="mono-meta">{t('fit.cardio.km')}</span>
          <input
            className="mono-field mono-field-sm"
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_CARDIO_KM}
            step="0.01"
            value={km}
            onChange={(e) => setKm(e.target.value)}
          />
        </label>
        <label className="mono-fit-label mono-fit-label-date">
          <span className="mono-meta">{t('fit.cardio.date')}</span>
          <input
            className="mono-field mono-field-sm"
            type="date"
            max={today}
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              setError(false);
            }}
          />
        </label>
      </div>
      <p className="mono-meta mono-fit-num" aria-live="polite" data-testid="fit-cardio-pace">
        {pace
          ? t('fit.cardio.pace', { pace: paceText(t, fmtNum, pace) })
          : t('fit.cardio.paceHint')}
      </p>
      {error ? (
        <p className="mono-meta mono-fit-danger" role="alert">
          {t('fit.cardio.invalid', { max: MAX_CARDIO_MIN })}
        </p>
      ) : null}
      <div className="mono-fit-actions mono-fit-builder-foot">
        <MonoBtn type="button" onClick={save}>
          {t('fit.cardio.save')}
        </MonoBtn>
        <MonoBtn type="button" variant="ghost" onClick={onCancel}>
          {t('fit.b.cancel')}
        </MonoBtn>
      </div>
    </section>
  );
}
