import { useMemo, useState } from 'react';
import MonoBtn from './MonoBtn';
import MonoChip from './MonoChip';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { I18n, TKey } from '../lib/i18n';
import { fitKey, type Exercise } from '../lib/fitness/library';
import type { WorkoutEntry } from '../lib/fitness/workouts';
import {
  FREE_TARGETS,
  PERIOD_GOAL_LEVEL,
  PRO_RANGES,
  REPORT_RANGES,
  TARGET_PERIODS,
  displayMetric,
  exerciseHistory,
  exerciseTotals,
  metricOf,
  metricValue,
  newTarget,
  reportRange,
  targetProgress,
  type ExerciseTarget,
  type ReportRange,
  type TargetMetric,
  type TargetPeriod,
} from '../lib/fitness/targets';
import type { GoalLevel } from '../lib/goals';

/** "1 240" reps, or "42:10" / "3 h 5 min" of holding. */
export function metricText(
  i18n: Pick<I18n, 't' | 'fmtNum' | 'fmtDur'>,
  metric: TargetMetric,
  value: number,
): string {
  if (metric === 'reps') return i18n.t('fit.goal.reps', { n: i18n.fmtNum(value) });
  const s = Math.round(value);
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return i18n.fmtDur(Math.round(s / 60));
}

/** "100 reps a day", "10 min a month". */
export function targetText(i18n: Pick<I18n, 't' | 'fmtNum' | 'fmtDur'>, t: ExerciseTarget): string {
  const metric = metricOf(t.ex);
  const amount =
    metric === 'sec'
      ? i18n.fmtDur(Math.round(t.amount / 60))
      : i18n.t('fit.goal.reps', { n: i18n.fmtNum(t.amount) });
  return i18n.t(`fit.goal.per.${t.period}` as TKey, { amount });
}

interface Props {
  ex: Exercise;
  log: WorkoutEntry[];
  isPro: boolean;
  targets: ExerciseTarget[];
  onTargets: (targets: ExerciseTarget[]) => void;
  /** Creates the mirrored Goal; returns its id, or null when Goals is full. */
  onAddGoal?: (title: string, level: GoalLevel) => string | null;
}

/** Per-exercise report (totals by range, weekly bars) and this exercise's goals. */
export default function MonoExerciseReport({
  ex,
  log,
  isPro,
  targets,
  onTargets,
  onAddGoal,
}: Props) {
  const i18n = useI18n();
  const { t, fmtNum } = i18n;
  const [range, setRange] = useState<ReportRange>('d30');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<TargetPeriod>('week');
  const [toGoals, setToGoals] = useState(true);
  const [goalFull, setGoalFull] = useState(false);
  const metric = metricOf(ex.id);
  const locked = !isPro && PRO_RANGES.includes(range);
  const [from, to] = reportRange(range);
  const totals = useMemo(() => exerciseTotals(log, ex.id, from, to), [log, ex.id, from, to]);
  const shown = displayMetric(ex.id, totals);
  const weeks = useMemo(() => exerciseHistory(log, ex.id, 'week', 8), [log, ex.id]);
  const peak = Math.max(1, ...weeks.map((w) => w.value));
  const mine = targets.filter((x) => x.ex === ex.id);
  const canAdd = isPro || targets.length < FREE_TARGETS;
  const name = t(fitKey.exName(ex.id));

  const save = () => {
    const n = Number.parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return;
    let target = newTarget(ex.id, metric === 'sec' ? n * 60 : n, period);
    setGoalFull(false);
    if (toGoals && onAddGoal) {
      const title = t('fit.goal.goalTitle', { name, target: targetText(i18n, target) });
      const goalId = onAddGoal(title, PERIOD_GOAL_LEVEL[period]);
      if (goalId) target = { ...target, goalId };
      else setGoalFull(true);
    }
    onTargets([...targets, target]);
    setAmount('');
  };

  const tile = (label: string, value: string) => (
    <div className="mono-fit-tile">
      <span className="mono-fit-tile-val mono-fit-num">{value}</span>
      <span className="mono-meta mono-fit-small">{label}</span>
    </div>
  );

  return (
    <>
      <section className="mono-sec" aria-labelledby="fit-x-report" data-testid="fit-x-report">
        <h3 className="mono-h3" id="fit-x-report">
          {t('fit.rep.title')}
        </h3>
        <div className="mono-pack-row" role="group" aria-label={t('fit.rep.rangeAria')}>
          {REPORT_RANGES.map((r) => (
            <MonoChip key={r} type="button" pressed={range === r} onClick={() => setRange(r)}>
              {t(`fit.rep.range.${r}` as TKey)}
              {!isPro && PRO_RANGES.includes(r) ? ' · Pro' : ''}
            </MonoChip>
          ))}
        </div>
        {locked ? (
          <p className="mono-note">{t('fit.rep.pro')}</p>
        ) : totals.sets === 0 ? (
          <p className="mono-meta">{t('fit.rep.none')}</p>
        ) : (
          <div className="mono-fit-tiles">
            {tile(
              t(shown === 'sec' ? 'fit.rep.totalTime' : 'fit.rep.totalReps'),
              shown === 'sec'
                ? metricText(i18n, 'sec', totals.sec)
                : fmtNum(metricValue(totals, 'reps')),
            )}
            {tile(t('fit.rep.sets'), fmtNum(totals.sets))}
            {tile(t('fit.rep.sessions'), fmtNum(totals.sessions))}
            {tile(
              t('fit.rep.best'),
              metric === 'sec' ? metricText(i18n, 'sec', totals.bestSec) : fmtNum(totals.bestReps),
            )}
            {totals.maxKg > 0
              ? tile(t('fit.rep.maxKg'), t('fit.pack.kg', { n: fmtNum(totals.maxKg) }))
              : null}
            {totals.volume > 0
              ? tile(t('fit.rep.volume'), t('fit.pack.kg', { n: fmtNum(totals.volume) }))
              : null}
          </div>
        )}
        {weeks.some((w) => w.value > 0) ? (
          <div
            className="mono-fit-bars"
            role="img"
            aria-label={t('fit.rep.barsAria', {
              name,
              values: weeks.map((w) => metricText(i18n, metric, w.value)).join(', '),
            })}
          >
            {weeks.map((w, i) => (
              <span key={w.start} className="mono-fit-bar">
                <span
                  className={i === weeks.length - 1 ? 'is-now' : ''}
                  style={{ height: `${Math.max(4, Math.round((w.value / peak) * 100))}%` }}
                />
              </span>
            ))}
          </div>
        ) : null}
        {weeks.some((w) => w.value > 0) ? (
          <p className="mono-meta mono-fit-small">{t('fit.rep.barsHint')}</p>
        ) : null}
      </section>

      <section className="mono-sec" aria-labelledby="fit-x-goal" data-testid="fit-x-goal">
        <h3 className="mono-h3" id="fit-x-goal">
          {t('fit.goal.title')}
        </h3>
        {mine.map((target) => {
          const p = targetProgress(log, target);
          return (
            <div key={target.id} className="mono-fit-goal">
              <div className="mono-fit-goal-head">
                <span className="mono-fit-name">{targetText(i18n, target)}</span>
                <button
                  type="button"
                  className="mono-link-btn"
                  aria-label={t('fit.goal.removeAria', { name })}
                  onClick={() => onTargets(targets.filter((x) => x.id !== target.id))}
                >
                  {t('fit.goal.remove')}
                </button>
              </div>
              <div
                className="mono-fit-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={p.pct}
                aria-label={targetText(i18n, target)}
              >
                <span style={{ width: `${p.pct}%` }} />
              </div>
              <p className="mono-meta mono-fit-small mono-fit-num">
                {t('fit.goal.progress', {
                  done: metricText(i18n, metric, p.done),
                  amount: metricText(i18n, metric, p.amount),
                  pct: p.pct,
                })}
                {target.goalId ? ` · ${t('fit.goal.inGoals')}` : ''}
              </p>
            </div>
          );
        })}
        {canAdd ? (
          <div className="mono-fit-goal-form">
            <label className="mono-fit-label">
              <span className="mono-meta">
                {t(metric === 'sec' ? 'fit.goal.amountMin' : 'fit.goal.amountReps')}
              </span>
              <input
                className="mono-field"
                type="number"
                inputMode="decimal"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <div className="mono-pack-row" role="group" aria-label={t('fit.goal.periodAria')}>
              {TARGET_PERIODS.map((p) => (
                <MonoChip key={p} type="button" pressed={period === p} onClick={() => setPeriod(p)}>
                  {t(`fit.goal.period.${p}` as TKey)}
                </MonoChip>
              ))}
            </div>
            {onAddGoal ? (
              <label className="mono-check">
                <input
                  type="checkbox"
                  checked={toGoals}
                  onChange={(e) => setToGoals(e.target.checked)}
                />
                <span>{t('fit.goal.toGoals')}</span>
              </label>
            ) : null}
            <MonoBtn type="button" onClick={save} disabled={!amount}>
              {t('fit.goal.save')}
            </MonoBtn>
            {goalFull ? <p className="mono-note">{t('fit.goal.goalsFull')}</p> : null}
          </div>
        ) : (
          <p className="mono-note">{t('fit.goal.pro', { n: FREE_TARGETS })}</p>
        )}
      </section>
    </>
  );
}
