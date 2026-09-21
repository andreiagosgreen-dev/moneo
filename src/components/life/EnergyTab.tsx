import { useMemo, useState } from 'react';
import {
  energyAdvice,
  logEnergy,
  peakHours,
  formatHour,
  predictPeak,
  breakAdvice,
} from '../../lib/energy';
import { localDayKey } from '../../lib/projects';
import type { LifeCardProps } from './types';
import { useI18n } from '../../lib/i18n/LocaleContext';

export default function EnergyTab({
  energyLog,
  energyLogChange,
  history,
  isPro = false,
}: LifeCardProps) {
  const { t, tp } = useI18n();
  const [level, setLevel] = useState(7);
  const now = useMemo(() => Date.now(), []);
  const peak = useMemo(() => (isPro ? predictPeak(energyLog, now) : null), [energyLog, isPro, now]);
  const rest = useMemo(() => breakAdvice(history, now), [history, now]);
  const peaks = useMemo(() => (isPro ? peakHours(energyLog, now, 3) : []), [energyLog, isPro, now]);
  const advice = useMemo(
    () => (isPro ? energyAdvice(energyLog, now) : null),
    [energyLog, isPro, now],
  );
  const todayCount = energyLog.filter((e) => localDayKey(e.at) === localDayKey(now)).length;

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={1}
          max={10}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="h-1.5 flex-1 accent-[var(--accent)]"
          aria-label={t('energy.levelLabel')}
        />
        <span className="w-8 shrink-0 text-center font-display text-xl font-bold text-cream">
          {level}
        </span>
        <button
          onClick={() => energyLogChange(logEnergy(energyLog, level))}
          className="press btn-accent shrink-0 rounded-lg px-4 py-2 text-sm font-semibold"
        >
          {t('energy.log')}
        </button>
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-faint">{tp('energy.checkin', todayCount)}</p>
      {rest && (
        <p className="mt-2 rounded-lg bg-tomato/10 px-3 py-2 text-[12px] leading-relaxed text-cream ring-1 ring-inset ring-tomato/30">
          ☕ {rest}
        </p>
      )}
      {isPro && peak && (
        <p className="mt-2 font-mono text-[11px] text-sage">
          {t('energy.peakToday', { hour: formatHour(peak.hour), avg: peak.avg.toFixed(1) })}
        </p>
      )}

      {isPro ? (
        <div className="mt-3">
          {advice && <p className="text-[13px] leading-relaxed text-cream/90">{advice}</p>}
          {peaks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {peaks.map((p) => (
                <span
                  key={p.hour}
                  className="rounded-full bg-ink/60 px-2.5 py-1 font-mono text-[11px] text-sage ring-1 ring-inset ring-line"
                  title={t('energy.samplesTitle', { samples: p.samples, avg: p.avg.toFixed(1) })}
                >
                  ⚡ {formatHour(p.hour)} · {p.avg.toFixed(1)}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 font-mono text-[11px] text-faint">{t('energy.proUpsell')}</p>
      )}
    </div>
  );
}
