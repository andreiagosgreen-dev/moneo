import { useMemo, useState } from 'react';
import MonoChip from './MonoChip';
import MonoExerciseIcon from './MonoExerciseIcon';
import { metricText, targetText } from './MonoExerciseReport';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n';
import { fitKey, getExercise } from '../lib/fitness/library';
import type { WorkoutStore } from '../lib/fitness/workouts';
import {
  PRO_RANGES,
  REPORT_RANGES,
  metricOf,
  metricValue,
  reportRange,
  targetProgress,
  trainedExercises,
  type ReportRange,
} from '../lib/fitness/targets';

interface Props {
  store: WorkoutStore;
  isPro: boolean;
  onOpen: (exId: string) => void;
}

const TOP = 8;

/** Move tab: exercise goals with live progress, and totals per exercise over a range. */
export default function MonoExerciseGoals({ store, isPro, onOpen }: Props) {
  const i18n = useI18n();
  const { t, fmtNum } = i18n;
  const [range, setRange] = useState<ReportRange>('d30');
  const targets = store.targets ?? [];
  const locked = !isPro && PRO_RANGES.includes(range);
  const [from, to] = reportRange(range);
  const rows = useMemo(
    () => (locked ? [] : trainedExercises(store.log, from, to).slice(0, TOP)),
    [store.log, from, to, locked],
  );

  return (
    <section className="mono-sec" aria-labelledby="fit-goals-title" data-testid="fit-goals">
      <h2 className="mono-h3" id="fit-goals-title">
        {t('fit.goal.listTitle')}
      </h2>
      {targets.length === 0 ? (
        <p className="mono-meta">{t('fit.goal.empty')}</p>
      ) : (
        <ul className="mono-fit-list">
          {targets.map((target) => {
            const ex = getExercise(target.ex);
            if (!ex) return null;
            const p = targetProgress(store.log, target);
            const metric = metricOf(target.ex);
            const name = t(fitKey.exName(target.ex));
            return (
              <li key={target.id}>
                <button
                  type="button"
                  className="mono-fit-row mono-fit-rowbtn"
                  aria-label={t('fit.lib.openAria', { name })}
                  onClick={() => onOpen(target.ex)}
                >
                  <MonoExerciseIcon pose={ex.pose} size={40} />
                  <span className="mono-fit-row-copy">
                    <span className="mono-fit-name">{name}</span>
                    <span className="mono-meta mono-fit-small">{targetText(i18n, target)}</span>
                    <span
                      className="mono-fit-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={p.pct}
                      aria-label={`${name}: ${targetText(i18n, target)}`}
                    >
                      <span style={{ width: `${p.pct}%` }} />
                    </span>
                    <span className="mono-meta mono-fit-small mono-fit-num">
                      {t('fit.goal.progress', {
                        done: metricText(i18n, metric, p.done),
                        amount: metricText(i18n, metric, p.amount),
                        pct: p.pct,
                      })}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mono-h3 mono-fit-subhead">{t('fit.rep.listTitle')}</h3>
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
      ) : rows.length === 0 ? (
        <p className="mono-meta">{t('fit.rep.empty')}</p>
      ) : (
        <ul className="mono-fit-list" data-testid="fit-rep-list">
          {rows.map(({ ex: id, totals }) => {
            const ex = getExercise(id)!;
            const metric = metricOf(id);
            const name = t(fitKey.exName(id));
            return (
              <li key={id}>
                <button
                  type="button"
                  className="mono-fit-row mono-fit-rowbtn"
                  aria-label={t('fit.lib.openAria', { name })}
                  onClick={() => onOpen(id)}
                >
                  <MonoExerciseIcon pose={ex.pose} size={40} />
                  <span className="mono-fit-row-copy">
                    <span className="mono-fit-name">{name}</span>
                    <span className="mono-meta mono-fit-small mono-fit-num">
                      {t('fit.rep.rowMeta', {
                        total: metricText(i18n, metric, metricValue(totals, metric)),
                        sets: fmtNum(totals.sets),
                        sessions: fmtNum(totals.sessions),
                      })}
                    </span>
                  </span>
                  <span className="mono-tpl-chev" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
