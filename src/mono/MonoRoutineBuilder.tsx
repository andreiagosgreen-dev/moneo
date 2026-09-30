import { useState } from 'react';
import MonoBtn from './MonoBtn';
import MonoExerciseIcon from './MonoExerciseIcon';
import MonoExercisePicker from './MonoExercisePicker';
import { useI18n } from '../lib/i18n/LocaleContext';
import { exerciseStep, fitKey, getExercise, type FitPlace } from '../lib/fitness/library';
import {
  MAX_CUSTOM_STEPS,
  MAX_ROUTINE_NAME,
  cleanStep,
  type CustomRoutine,
} from '../lib/fitness/custom';
import type { RoutineStep } from '../lib/fitness/library';

interface Props {
  initial?: CustomRoutine;
  place?: FitPlace;
  onSave: (name: string, steps: RoutineStep[]) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

interface Row {
  key: number;
  ex: string;
  sets: string;
  /** Reps, or seconds for timed exercises. */
  amount: string;
  rest: string;
}

let rowKey = 0;
const toRow = (s: RoutineStep): Row => ({
  key: ++rowKey,
  ex: s.ex,
  sets: String(s.sets),
  amount: String(s.sec ?? s.reps ?? ''),
  rest: String(s.restSec),
});

function toStep(r: Row): RoutineStep | null {
  const timed = getExercise(r.ex)?.mode === 'time';
  const n = (v: string) => Number.parseInt(v, 10);
  return cleanStep({
    ex: r.ex,
    sets: n(r.sets),
    restSec: n(r.rest),
    ...(timed ? { sec: n(r.amount) } : { reps: n(r.amount) }),
  });
}

/** Name a routine, pick exercises from the library, set sets/reps/rest. */
export default function MonoRoutineBuilder({ initial, place, onSave, onCancel, onDelete }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [rows, setRows] = useState<Row[]>(() => (initial?.steps ?? []).map(toRow));
  const [adding, setAdding] = useState(!initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const full = rows.length >= MAX_CUSTOM_STEPS;
  const steps = rows.map(toStep).filter((s): s is RoutineStep => s !== null);
  const canSave = name.trim().length > 0 && steps.length > 0;

  const patch = (key: number, p: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (i: number, by: -1 | 1) =>
    setRows((list) => {
      const j = i + by;
      if (j < 0 || j >= list.length) return list;
      const next = list.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = (id: string) => {
    if (full) return;
    setRows((list) => [...list, toRow(exerciseStep(id))]);
  };

  return (
    <section className="mono-fit-builder" data-testid="fit-builder" aria-labelledby="fit-b-title">
      <button type="button" className="mono-link-btn mono-fit-back" onClick={onCancel}>
        ‹ {t('fit.b.cancel')}
      </button>
      <h2 className="mono-h2" id="fit-b-title">
        {initial ? t('fit.b.editTitle') : t('fit.b.title')}
      </h2>
      <label className="mono-fit-label">
        <span className="mono-meta">{t('fit.b.name')}</span>
        <input
          className="mono-field"
          value={name}
          maxLength={MAX_ROUTINE_NAME}
          placeholder={t('fit.b.namePh')}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <h3 className="mono-h3">{t('fit.b.steps')}</h3>
      {rows.length === 0 ? <p className="mono-meta">{t('fit.b.none')}</p> : null}
      <ol className="mono-fit-steps">
        {rows.map((r, i) => {
          const ex = getExercise(r.ex);
          if (!ex) return null;
          const exName = t(fitKey.exName(ex.id));
          return (
            <li key={r.key} className="mono-fit-step" data-testid={`fit-b-step-${ex.id}`}>
              <div className="mono-fit-step-head">
                <MonoExerciseIcon pose={ex.pose} size={32} />
                <span className="mono-fit-name">{exName}</span>
                <span className="mono-fit-step-tools">
                  <button
                    type="button"
                    className="mono-fit-icobtn"
                    aria-label={t('fit.b.up', { name: exName })}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="mono-fit-icobtn"
                    aria-label={t('fit.b.down', { name: exName })}
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="mono-fit-icobtn"
                    aria-label={t('fit.b.remove', { name: exName })}
                    onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                  >
                    ×
                  </button>
                </span>
              </div>
              <div className="mono-fit-inputs">
                <label className="mono-fit-label">
                  <span className="mono-meta">{t('fit.b.sets')}</span>
                  <input
                    className="mono-field mono-field-sm"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10}
                    value={r.sets}
                    onChange={(e) => patch(r.key, { sets: e.target.value })}
                  />
                </label>
                <label className="mono-fit-label">
                  <span className="mono-meta">
                    {ex.mode === 'time' ? t('fit.b.sec') : t('fit.p.reps')}
                  </span>
                  <input
                    className="mono-field mono-field-sm"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={ex.mode === 'time' ? 3600 : 200}
                    value={r.amount}
                    onChange={(e) => patch(r.key, { amount: e.target.value })}
                  />
                </label>
                <label className="mono-fit-label">
                  <span className="mono-meta">{t('fit.b.rest')}</span>
                  <input
                    className="mono-field mono-field-sm"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={600}
                    value={r.rest}
                    onChange={(e) => patch(r.key, { rest: e.target.value })}
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ol>

      {full ? (
        <p className="mono-meta" role="note">
          {t('fit.b.limit', { n: MAX_CUSTOM_STEPS })}
        </p>
      ) : adding ? (
        <MonoExercisePicker place={place} onPick={add} label={t('fit.b.add')} />
      ) : (
        <MonoBtn type="button" variant="ghost" block onClick={() => setAdding(true)}>
          + {t('fit.b.add')}
        </MonoBtn>
      )}

      <div className="mono-fit-actions mono-fit-builder-foot">
        <MonoBtn type="button" disabled={!canSave} onClick={() => onSave(name.trim(), steps)}>
          {t('fit.b.save')}
        </MonoBtn>
        <MonoBtn type="button" variant="ghost" onClick={onCancel}>
          {t('fit.b.cancel')}
        </MonoBtn>
      </div>

      {onDelete ? (
        confirmDelete ? (
          <div className="mono-fit-confirm" role="group" aria-label={t('fit.b.deleteAsk')}>
            <p className="mono-meta">{t('fit.b.deleteAsk')}</p>
            <div className="mono-fit-actions">
              <MonoBtn type="button" variant="ghost" onClick={onDelete}>
                {t('fit.b.delete')}
              </MonoBtn>
              <MonoBtn type="button" onClick={() => setConfirmDelete(false)}>
                {t('fit.b.cancel')}
              </MonoBtn>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="mono-link-btn mono-fit-danger"
            onClick={() => setConfirmDelete(true)}
          >
            {t('fit.b.delete')}
          </button>
        )
      ) : null}
    </section>
  );
}
