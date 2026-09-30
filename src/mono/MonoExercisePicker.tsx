import { useState } from 'react';
import MonoBtn from './MonoBtn';
import MonoExerciseIcon from './MonoExerciseIcon';
import { useI18n } from '../lib/i18n/LocaleContext';
import {
  MUSCLES,
  filterExercises,
  fitKey,
  type FitPlace,
  type Muscle,
} from '../lib/fitness/library';

interface Props {
  onPick: (id: string) => void;
  /** Preselected place from the Move tab (the user can widen it). */
  place?: FitPlace;
  label: string;
}

const PAGE = 12;

/** Search + muscle filter over the library; one tap adds an exercise. */
export default function MonoExercisePicker({ onPick, place, label }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all');
  const [here, setHere] = useState(place !== undefined);
  const [shown, setShown] = useState(PAGE);
  const list = filterExercises(
    {
      place: here ? place : undefined,
      muscle: muscle === 'all' ? undefined : muscle,
      query,
    },
    (id) => t(fitKey.exName(id)),
  );

  return (
    <div className="mono-fit-picker" role="group" aria-label={label}>
      <input
        type="search"
        className="mono-field mono-fit-search"
        value={query}
        placeholder={t('fit.lib.search')}
        aria-label={t('fit.lib.search')}
        onChange={(e) => {
          setQuery(e.target.value);
          setShown(PAGE);
        }}
      />
      <div className="mono-fit-selects">
        <label className="mono-fit-select">
          <span className="mono-eyebrow">{t('fit.lib.muscle')}</span>
          <select
            className="mono-field mono-field-sm"
            value={muscle}
            onChange={(e) => {
              setMuscle(e.target.value as Muscle | 'all');
              setShown(PAGE);
            }}
          >
            <option value="all">{t('fit.muscle.all')}</option>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {t(fitKey.muscle(m))}
              </option>
            ))}
          </select>
        </label>
        {place ? (
          <label className="mono-fit-check">
            <input type="checkbox" checked={here} onChange={(e) => setHere(e.target.checked)} />
            <span className="mono-meta">
              {t('fit.pick.here', { place: t(fitKey.place(place)) })}
            </span>
          </label>
        ) : null}
      </div>
      {list.length > 0 ? (
        <ul className="mono-fit-list" data-testid="fit-picker">
          {list.slice(0, shown).map((e) => {
            const name = t(fitKey.exName(e.id));
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className="mono-fit-row mono-fit-rowbtn"
                  aria-label={t('fit.pick.addAria', { name })}
                  onClick={() => onPick(e.id)}
                >
                  <MonoExerciseIcon pose={e.pose} size={36} />
                  <span className="mono-fit-row-copy">
                    <span className="mono-fit-name">{name}</span>
                    <span className="mono-meta mono-fit-small">
                      {t(fitKey.muscle(e.muscles[0]))} · {t(fitKey.eq(e.equipment))}
                    </span>
                  </span>
                  <span className="mono-fit-add" aria-hidden>
                    +
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mono-empty">{t('fit.lib.empty')}</p>
      )}
      {list.length > shown ? (
        <MonoBtn type="button" variant="ghost" block onClick={() => setShown((n) => n + PAGE)}>
          {t('fit.lib.more', { n: list.length - shown })}
        </MonoBtn>
      ) : null}
    </div>
  );
}
