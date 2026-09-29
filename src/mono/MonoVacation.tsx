import { useState } from 'react';
import MonoBtn from './MonoBtn';
import MonoChip from './MonoChip';
import { useI18n } from '../lib/i18n/LocaleContext';
import { addDays, compareDayKeys, dayKeyDiff } from '../lib/dayKeys';
import { addTimeOffRange, removeTimeOffRange, TIME_OFF_RANGE_MAX } from '../lib/journal';
import {
  currentVacation,
  dayKeyFromInput,
  inputFromDayKey,
  upcomingVacations,
  type VacationRange,
} from '../lib/vacation';

interface Props {
  timeOff: string[];
  onChange: (days: string[]) => void;
  todayKey: string;
}

/** Remove what is left of a range from today on; past days stay (history is honest). */
function endRange(timeOff: string[], r: VacationRange, todayKey: string): string[] {
  const from = compareDayKeys(r.from, todayKey) < 0 ? todayKey : r.from;
  return removeTimeOffRange(timeOff, from, r.to);
}

/** Vacation mode card: pick a range, end the current one, manage upcoming ones. */
export default function MonoVacation({ timeOff, onChange, todayKey }: Props) {
  const { t, fmtDayKey } = useI18n();
  const [from, setFrom] = useState(inputFromDayKey(todayKey));
  const [to, setTo] = useState(inputFromDayKey(addDays(todayKey, 3)));
  const fromKey = dayKeyFromInput(from);
  const toKey = dayKeyFromInput(to);
  const span = fromKey && toKey ? dayKeyDiff(fromKey, toKey) : NaN;
  const tooLong = Number.isFinite(span) && span >= TIME_OFF_RANGE_MAX;
  const valid =
    fromKey !== null &&
    toKey !== null &&
    span >= 0 &&
    !tooLong &&
    compareDayKeys(toKey, todayKey) >= 0;
  const current = currentVacation(timeOff, todayKey);
  const upcoming = upcomingVacations(timeOff, todayKey);

  return (
    <section className="mono-vac" aria-labelledby="mono-vac-title" data-testid="vacation">
      <p id="mono-vac-title" className="mono-h3">
        {t('mono.vac.title')}
      </p>
      <p className="mono-meta" style={{ marginTop: 2 }}>
        {t('mono.vac.desc')}
      </p>
      <div className="mono-vac-row">
        <label className="mono-vac-field">
          <span className="mono-eyebrow">{t('mono.vac.from')}</span>
          <input
            type="date"
            className="mono-field"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="mono-vac-field">
          <span className="mono-eyebrow">{t('mono.vac.to')}</span>
          <input
            type="date"
            className="mono-field"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {tooLong ? (
        <p className="mono-meta" role="alert">
          {t('mono.vac.tooLong')}
        </p>
      ) : null}
      <div className="mono-vac-actions">
        <MonoBtn
          type="button"
          variant="primary"
          disabled={!valid}
          onClick={() => fromKey && toKey && onChange(addTimeOffRange(timeOff, fromKey, toKey))}
        >
          {t('mono.vac.start')}
        </MonoBtn>
        {current ? (
          <MonoBtn
            type="button"
            variant="ghost"
            onClick={() => onChange(endRange(timeOff, current, todayKey))}
          >
            {t('mono.vac.stop')}
          </MonoBtn>
        ) : null}
      </div>
      {upcoming.length > 0 ? (
        <ul className="mono-vac-list">
          {upcoming.map((r) => {
            const label = t('mono.vac.remove', { from: fmtDayKey(r.from), to: fmtDayKey(r.to) });
            return (
              <li key={r.from}>
                <span className="mono-meta">
                  {fmtDayKey(r.from)} – {fmtDayKey(r.to)}
                </span>
                <MonoChip
                  type="button"
                  aria-label={label}
                  onClick={() => onChange(endRange(timeOff, r, todayKey))}
                >
                  ✕
                </MonoChip>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/** Today banner while on vacation. */
export function MonoVacationBanner({ timeOff, onChange, todayKey }: Props) {
  const { t, fmtDayKey } = useI18n();
  const current = currentVacation(timeOff, todayKey);
  if (!current) return null;
  return (
    <div className="mono-card mono-vac-banner" role="status" data-testid="vacation-banner">
      <p className="mono-meta">{t('mono.vac.banner', { date: fmtDayKey(current.to) })}</p>
      <MonoChip type="button" onClick={() => onChange(endRange(timeOff, current, todayKey))}>
        {t('mono.vac.stop')}
      </MonoChip>
    </div>
  );
}
