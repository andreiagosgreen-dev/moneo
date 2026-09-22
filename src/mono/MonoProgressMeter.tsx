import { useI18n } from '../lib/i18n/LocaleContext';
import type { SessionImpact } from '../lib/progress';

/**
 * Progress Meter: the visible payoff of one focus round.
 * Shows "you moved [Project] by X" with task-target percent, week
 * accumulation and the linked goal rollup. Purely presentational —
 * App computes the impact at session completion.
 *
 * Motion: a short width-grow on the bar (transform only). Under
 * prefers-reduced-motion the bar renders at its final width with no
 * animation; every value is also plain text (screen-reader safe).
 */
export default function MonoProgressMeter({ impact }: { impact: SessionImpact }) {
  const { t, fmtDur, fmtNum } = useI18n();
  if (impact.kind === 'none') return null;
  const pct = impact.pct ?? 0;

  return (
    <div role="status" className="mono-meter" aria-label={t('timer.done.focus')}>
      <p className="mono-h3">
        {impact.reachedMilestone
          ? t('prog.meter.milestone', { project: impact.projectName })
          : t('prog.meter.moved', {
              project: impact.projectName,
              dur: fmtDur(impact.sessionMin),
            })}
      </p>
      <div className="meter-track" aria-hidden="true">
        <div
          className="meter-fill"
          style={{
            width: `${pct}%`,
            background: impact.projectColor,
            boxShadow: `0 0 8px ${impact.projectColor}44`,
          }}
        />
      </div>
      <p className="mono-meta" style={{ marginTop: 6 }}>
        {impact.pct !== null
          ? t('prog.meter.tasks', {
              done: fmtNum(impact.doneTasks),
              total: fmtNum(impact.totalTasks),
              pct: fmtNum(impact.pct),
            })
          : t('prog.meter.week', {
              dur: fmtDur(impact.sessionMin),
              total: fmtDur(impact.projectMinutes),
            })}
      </p>
      {impact.pct !== null && (
        <p className="mono-meta" style={{ marginTop: 2 }}>
          {t('prog.meter.week', {
            dur: fmtDur(impact.weekMin),
            total: fmtDur(impact.projectMinutes),
          })}
        </p>
      )}
      {impact.goalTitle !== null && impact.goalPct !== null && (
        <p className="mono-meta" style={{ marginTop: 2 }}>
          {t('prog.meter.goal', { goal: impact.goalTitle, pct: fmtNum(impact.goalPct) })}
        </p>
      )}
    </div>
  );
}
