import MonoBtn from './MonoBtn';
import { useI18n } from '../lib/i18n/LocaleContext';
import { FIRST_STEPS, type FirstStepId, type FirstStepsProgress } from '../lib/firstSteps';

interface Props {
  view: 'steps' | 'celebrate';
  progress: FirstStepsProgress;
  /** Pro or trial: the third step also offers an AI plan. */
  canAiPlan: boolean;
  onTask: () => void;
  onFocus: () => void;
  onWorkout: () => void;
  onPlan: () => void;
  onTryTheme: () => void;
  onDismiss: () => void;
}

const ICON: Record<FirstStepId, string> = { task: '✍️', focus: '⏱', try: '✨' };

/** "Your first steps": three wins for a new user, then a theme as a reward. */
export default function MonoFirstSteps({
  view,
  progress,
  canAiPlan,
  onTask,
  onFocus,
  onWorkout,
  onPlan,
  onTryTheme,
  onDismiss,
}: Props) {
  const { t } = useI18n();

  if (view === 'celebrate') {
    return (
      <section
        className="mono-card mono-first mono-first-done"
        aria-labelledby="first-title"
        data-testid="first-steps"
      >
        <p className="mono-first-burst" aria-hidden>
          🎉
        </p>
        <h2 className="mono-h2" id="first-title">
          {t('first.done.t')}
        </h2>
        <p className="mono-meta">{t('first.done.b')}</p>
        <div className="mono-fit-actions">
          <MonoBtn type="button" onClick={onTryTheme}>
            {t('first.done.cta')}
          </MonoBtn>
          <MonoBtn type="button" variant="ghost" onClick={onDismiss}>
            {t('first.dismiss')}
          </MonoBtn>
        </div>
      </section>
    );
  }

  const next = FIRST_STEPS.find((s) => !progress.done[s]);
  const step = (id: FirstStepId) => {
    const done = progress.done[id];
    const isNext = id === next;
    return (
      <li
        key={id}
        className={`mono-first-step${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}
      >
        <span className="mono-first-dot" aria-hidden>
          {done ? '✓' : ICON[id]}
        </span>
        <div className="mono-first-copy">
          <p className="mono-fit-name">
            {t(`first.${id}.t` as const)}
            <span className="mono-sr-only">
              {' '}
              · {done ? t('first.stepDone') : t('first.stepTodo')}
            </span>
          </p>
          {!done ? <p className="mono-meta mono-fit-small">{t(`first.${id}.b` as const)}</p> : null}
          {isNext ? (
            <div className="mono-first-ctas">
              {id === 'task' ? (
                <MonoBtn type="button" onClick={onTask}>
                  {t('first.task.cta')}
                </MonoBtn>
              ) : id === 'focus' ? (
                <MonoBtn type="button" onClick={onFocus}>
                  {t('first.focus.cta')}
                </MonoBtn>
              ) : (
                <>
                  <MonoBtn type="button" onClick={onWorkout}>
                    {t('first.try.workout')}
                  </MonoBtn>
                  {canAiPlan ? (
                    <MonoBtn type="button" variant="ghost" onClick={onPlan}>
                      {t('first.try.plan')}
                    </MonoBtn>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <section
      className="mono-card mono-first"
      aria-labelledby="first-title"
      data-testid="first-steps"
    >
      <div className="mono-first-head">
        <h2 className="mono-h3" id="first-title">
          {t('first.title')}
        </h2>
        <span className="mono-tag mono-fit-num">{t('first.count', { n: progress.count })}</span>
      </div>
      <div
        className="mono-fit-progress"
        role="progressbar"
        aria-label={t('first.title')}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={progress.count}
      >
        <span style={{ width: `${Math.round((progress.count / 3) * 100)}%` }} />
      </div>
      <ol className="mono-first-list">{FIRST_STEPS.map(step)}</ol>
      <p className="mono-meta mono-fit-small">{t('first.reward')}</p>
      <button type="button" className="mono-link-btn mono-first-hide" onClick={onDismiss}>
        {t('first.dismiss')}
      </button>
    </section>
  );
}
