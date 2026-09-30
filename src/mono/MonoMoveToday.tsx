import MonoBtn from './MonoBtn';
import MonoCard from './MonoCard';
import MonoRing from './MonoRing';
import { useI18n } from '../lib/i18n/LocaleContext';
import { resolveRoutine, routineTitle } from '../lib/fitness/custom';
import { plannedOn, weekGoal, type WorkoutStore } from '../lib/fitness/workouts';

interface Props {
  store: WorkoutStore;
  /** Local day key ("YYYY-M-D"). */
  dayKey: string;
  onStart: (routineId: string) => void;
  onOpen: () => void;
  now?: number;
}

/** Today card: this week's workout ring + what is scheduled today. */
export default function MonoMoveToday({ store, dayKey, onStart, onOpen, now }: Props) {
  const { t, fmtNum } = useI18n();
  const goal = weekGoal(store, now);
  const planned = plannedOn(store, dayKey).filter((id) => resolveRoutine(store, id));
  const doneToday = store.log.filter((e) => e.day === dayKey);
  const open = planned.filter((id) => !doneToday.some((e) => e.routineId === id));
  const name = (id: string) => routineTitle(t, store, id);

  const headline =
    doneToday.length > 0
      ? t('mono.move.doneToday', { name: name(doneToday[doneToday.length - 1].routineId) })
      : open.length > 0
        ? t('mono.move.planned', { name: open.map(name).join(', ') })
        : t('mono.move.free');

  return (
    <section className="mono-sec mono-pad" aria-labelledby="mono-move-title">
      <p className="mono-eyebrow" id="mono-move-title" style={{ marginBottom: 8 }}>
        {t('mono.move.title')}
      </p>
      <MonoCard>
        <div className="mono-azi-summary" data-testid="move-today">
          <MonoRing
            value={goal.pct}
            size={56}
            stroke={5}
            label={t('fit.week.ringAria', { done: goal.done, goal: goal.goal })}
          >
            <span className="mono-fit-num">
              {fmtNum(goal.done)}/{fmtNum(goal.goal)}
            </span>
          </MonoRing>
          <div className="mono-list-grow">
            <div className="mono-h3">{headline}</div>
            <p className="mono-meta" style={{ marginTop: 3 }}>
              {t('mono.move.week', { done: fmtNum(goal.done), goal: fmtNum(goal.goal) })}
            </p>
          </div>
        </div>
        <div className="mono-row" style={{ gap: 8, marginTop: 12 }}>
          {open.length > 0 ? (
            <MonoBtn
              type="button"
              aria-label={t('fit.startAria', { name: name(open[0]) })}
              onClick={() => onStart(open[0])}
            >
              {t('fit.start')}
            </MonoBtn>
          ) : null}
          <MonoBtn type="button" variant="ghost" onClick={onOpen}>
            {t('mono.move.open')}
          </MonoBtn>
        </div>
      </MonoCard>
    </section>
  );
}
