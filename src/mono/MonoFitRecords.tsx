import { useMemo } from 'react';
import MonoExerciseIcon from './MonoExerciseIcon';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { I18n } from '../lib/i18n';
import { fitKey, getExercise } from '../lib/fitness/library';
import { exerciseBests, progressKind, type RecordKind } from '../lib/fitness/records';
import type { WorkoutEntry } from '../lib/fitness/workouts';

const SHOWN = 8;

export function holdClock(sec: number): string {
  const s = Math.round(sec);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "1RM ≈ 72.5 kg", "60 kg", "Reps: 25", "Hold: 1:30". */
export function recordText(
  t: I18n['t'],
  fmtNum: I18n['fmtNum'],
  kind: RecordKind,
  value: number,
): string {
  switch (kind) {
    case 'e1rm':
      return t('fit.rec.e1rm', { kg: fmtNum(value) });
    case 'kg':
      return t('fit.rec.kg', { kg: fmtNum(value) });
    case 'reps':
      return t('fit.rec.reps', { n: fmtNum(value) });
    case 'sec':
      return t('fit.rec.sec', { time: holdClock(value) });
  }
}

interface Props {
  log: WorkoutEntry[];
  isPro: boolean;
  onOpen: (exId: string) => void;
}

/** Best set per exercise (Pro); Free sees how many are waiting. */
export default function MonoFitRecords({ log, isPro, onOpen }: Props) {
  const { t, fmtNum } = useI18n();
  const bests = useMemo(
    () =>
      [...exerciseBests(log).values()]
        .filter((b) => getExercise(b.ex) && progressKind(b))
        .sort((a, b) => b.at - a.at),
    [log],
  );

  return (
    <section className="mono-sec" aria-labelledby="fit-rec-title">
      <h2 className="mono-h3" id="fit-rec-title">
        {t('fit.rec.title')}
        {isPro ? '' : ' · Pro'}
      </h2>
      <p className="mono-meta">{t('fit.rec.sub')}</p>
      {!isPro ? (
        <p className="mono-note" data-testid="fit-rec-pro">
          {t('fit.rec.pro')}
          {bests.length > 0 ? ` ${t('fit.rec.teaser', { n: bests.length })}` : ''}
        </p>
      ) : bests.length === 0 ? (
        <p className="mono-meta">{t('fit.rec.empty')}</p>
      ) : (
        <ul className="mono-fit-list" data-testid="fit-records">
          {bests.slice(0, SHOWN).map((b) => {
            const ex = getExercise(b.ex)!;
            const name = t(fitKey.exName(ex.id));
            const kind = progressKind(b)!;
            const main = recordText(t, fmtNum, kind, b[kind]!);
            const extra =
              kind === 'e1rm' && b.kg !== undefined
                ? ` · ${recordText(t, fmtNum, 'kg', b.kg)}`
                : '';
            return (
              <li key={b.ex}>
                <button
                  type="button"
                  className="mono-fit-row mono-fit-rowbtn"
                  aria-label={t('fit.rec.open', { name })}
                  onClick={() => onOpen(b.ex)}
                >
                  <MonoExerciseIcon pose={ex.pose} size={40} />
                  <span className="mono-fit-row-copy">
                    <span className="mono-fit-name">{name}</span>
                    <span className="mono-meta mono-fit-small">
                      {main}
                      {extra} · {t('fit.rec.sessions', { n: b.sessions })}
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
