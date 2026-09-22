import { useMemo, useState } from 'react';
import {
  AREA_LABEL_KEYS,
  balanceReport,
  burnoutGauge,
  resetLifeAreas,
  updateLifeArea,
} from '../../lib/lifeAreas';
import { moodAverage } from '../../lib/journal';
import { energyMean, restAdvice } from '../../lib/energy';
import { frogStats } from '../../lib/frog';
import { activeAreas } from '../../lib/focusAreas';
import { toggleTimeOff } from '../../lib/journal';
import type { LifeCardProps } from './types';
import { useI18n } from '../../lib/i18n/LocaleContext';
import type { TKey } from '../../lib/i18n/types';

export default function BalanceTab({
  lifeAreas,
  lifeAreasChange,
  focusAreas,
  history,
  timeOff,
  timeOffChange,
  goals,
  journal,
  energyLog,
  frogLog,
  isPro = false,
}: LifeCardProps) {
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [offDate, setOffDate] = useState('');
  const i18n = useI18n();
  const { t, fmtNum } = i18n;
  const live = useMemo(() => activeAreas(focusAreas), [focusAreas]);
  const report = useMemo(
    () => balanceReport(lifeAreas, history, Date.now(), 7, i18n),
    [lifeAreas, history, i18n],
  );
  const burnout = useMemo(() => {
    const stats = frogStats(frogLog);
    return burnoutGauge(
      {
        overtime: report.overtime,
        mood: moodAverage(journal),
        energy: energyMean(energyLog),
        frogSkipRate: stats.days >= 3 ? stats.skipped / stats.days : null,
      },
      i18n,
    );
  }, [report.overtime, journal, energyLog, frogLog, i18n]);
  const rest = useMemo(() => restAdvice(history, Date.now(), i18n), [history, i18n]);
  const levelLabel =
    burnout.level === 'high'
      ? t('life.bo.high')
      : burnout.level === 'guarded'
        ? t('life.bo.guarded')
        : t('life.bo.low');

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-4xl font-extrabold" style={{ color: 'var(--accent)' }}>
          {fmtNum(report.score)}
        </span>
        <span className="text-[12px] text-sage">{t('life.bal.score')}</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-cream/90">{report.advice}</p>
      {rest && (
        <p className="mt-2 rounded-lg bg-ink/40 px-3 py-2 text-[12px] leading-relaxed text-cream ring-1 ring-inset ring-line">
          😴 {rest}
        </p>
      )}
      {(burnout.level !== 'low' || burnout.reasons.length > 0) && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-[12px] leading-relaxed ring-1 ring-inset ${
            burnout.level === 'high'
              ? 'bg-tomato/10 text-cream ring-tomato/30'
              : burnout.level === 'guarded'
                ? 'bg-accent/10 text-cream ring-accent/30'
                : 'bg-ink/40 text-sage ring-line'
          }`}
          title={burnout.reasons.join(' · ') || t('life.bo.noWarn')}
        >
          {burnout.level === 'low'
            ? t('life.bal.clear')
            : t('life.bal.burnout', { level: levelLabel, reasons: burnout.reasons.join(' · ') })}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {report.areas.map((a) => {
          const source = lifeAreas.find((x) => x.id === a.id);
          const linkedIds = source?.linkedAreaIds ?? [];
          const areaGoals = goals.filter((g) => !g.archived && g.lifeAreaId === a.id);
          const areaLabel = source ? t(AREA_LABEL_KEYS[source.key] as TKey) : a.label;
          return (
            <li
              key={a.id}
              className="rounded-xl bg-ink/40 px-3.5 py-2.5 ring-1 ring-inset ring-line"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-cream/90">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  <span className="truncate">{areaLabel}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-sage">
                  {Math.round(a.actualPct)}% <span className="text-faint">/ {a.targetPct}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, a.targetPct > 0 ? (a.actualPct / a.targetPct) * 100 : 0)}%`,
                    background: a.color,
                  }}
                />
              </div>
              {areaGoals.length > 0 && (
                <p
                  className="mt-1.5 font-mono text-[10px] text-sage"
                  title={t('life.bal.goalsTitle')}
                >
                  🎯 {areaGoals.map((g) => g.title).join(' · ')}
                </p>
              )}
              {(linkingId === a.id || linkedIds.length > 0) && (
                <div className="mt-2 border-t border-line/60 pt-2">
                  {linkedIds.length > 0 && (
                    <p className="font-mono text-[10px] text-faint">
                      {t('life.bal.linked')}{' '}
                      {linkedIds
                        .map(
                          (id: string) =>
                            live.find((f) => f.id === id)?.name ?? t('life.bal.deleted'),
                        )
                        .join(', ')}
                    </p>
                  )}
                  {linkingId === a.id ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {live.map((f) => {
                        const on = linkedIds.includes(f.id);
                        return (
                          <button
                            key={f.id}
                            onClick={() => {
                              const next = on
                                ? linkedIds.filter((id: string) => id !== f.id)
                                : [...linkedIds, f.id];
                              lifeAreasChange(
                                updateLifeArea(lifeAreas, a.id, { linkedAreaIds: next }),
                              );
                            }}
                            className={`press rounded-full px-2.5 py-1 font-mono text-[10px] ring-1 ring-inset ${
                              on
                                ? 'text-accent ring-accent/50'
                                : 'text-faint ring-line hover:text-cream'
                            }`}
                            aria-pressed={on}
                          >
                            {f.name}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setLinkingId(null)}
                        className="press font-mono text-[10px] text-faint hover:text-cream"
                      >
                        {t('life.bal.done')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setLinkingId(a.id)}
                      className="press mt-1 font-mono text-[10px] text-sage hover:text-cream"
                    >
                      {t('life.bal.link')}
                    </button>
                  )}
                  {isPro && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-mono text-[10px] text-faint">
                        {t('life.bal.target')}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={a.targetPct}
                        onChange={(e) =>
                          lifeAreasChange(
                            updateLifeArea(lifeAreas, a.id, { targetPct: Number(e.target.value) }),
                          )
                        }
                        className="h-1.5 flex-1 accent-[var(--accent)]"
                        aria-label={t('life.bal.targetAria', { label: areaLabel })}
                      />
                      <span className="font-mono text-[10px] text-sage">{a.targetPct}%</span>
                    </div>
                  )}
                </div>
              )}
              {linkingId !== a.id && linkedIds.length === 0 && (
                <button
                  onClick={() => setLinkingId(a.id)}
                  className="press mt-1.5 font-mono text-[10px] text-sage hover:text-cream"
                >
                  {t('life.bal.link')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {report.unassignedMin > 0 && (
        <p className="mt-2 font-mono text-[11px] text-faint">
          {t('life.bal.unassigned', { n: fmtNum(report.unassignedMin) })}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        {!isPro && <p className="font-mono text-[11px] text-faint">{t('life.bal.proTargets')}</p>}
        <button
          onClick={() => {
            if (confirm(t('life.bal.resetConfirm'))) lifeAreasChange(resetLifeAreas());
          }}
          className="press ml-auto font-mono text-[11px] text-faint hover:text-cream"
        >
          {t('life.bal.reset')}
        </button>
      </div>
      <div className="mt-3 border-t border-line/60 pt-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          {t('life.bal.daysOff', { n: fmtNum(timeOff.length) })}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            value={offDate}
            onChange={(e) => setOffDate(e.target.value)}
            className="h-8 rounded-lg bg-ink/40 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
            aria-label={t('life.bal.dayOff')}
          />
          <button
            onClick={() => {
              if (!offDate) return;
              const [y, m, d] = offDate.split('-').map(Number);
              timeOffChange(toggleTimeOff(timeOff, `${y}-${m}-${d}`));
              setOffDate('');
            }}
            disabled={!offDate}
            className="press h-8 shrink-0 rounded-lg px-3 text-[12px] text-sage ring-1 ring-inset ring-line hover:text-cream disabled:opacity-40"
          >
            {t('life.bal.add')}
          </button>
        </div>
        {timeOff.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {timeOff.slice(-8).map((day) => (
              <span
                key={day}
                className="flex items-center gap-1 rounded-full bg-ink/60 px-2.5 py-1 font-mono text-[10px] text-sage ring-1 ring-inset ring-line"
              >
                🌴 {day}
                <button
                  onClick={() => timeOffChange(toggleTimeOff(timeOff, day))}
                  className="press text-faint hover:text-tomato"
                  aria-label={t('life.bal.remove', { day })}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
