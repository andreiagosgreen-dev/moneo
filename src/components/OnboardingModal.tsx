import { useState } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import { suggestTasksForGoal } from '../lib/goals';

interface Props {
  /** Dismiss without creating anything (marks onboarding seen). */
  onDone: () => void;
  /** Goal → suggested task → first session. Caller creates and selects. */
  onQuickStart: (goalTitle: string, taskTitle: string) => void;
}

type Step = 'goal' | 'task' | 'start';

const ORDER: Step[] = ['goal', 'task', 'start'];

/**
 * First-run funnel toward Focus: name an intention, take one first step,
 * land on the timer. Planning modules stay in their tabs — never promoted here.
 * Soft Pro mentions live only behind real gates (sync / export), not here.
 */
export default function OnboardingModal({ onDone, onQuickStart }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('goal');
  const [goalTitle, setGoalTitle] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const idx = ORDER.indexOf(step);

  const goTask = () => {
    const clean = goalTitle.trim();
    if (!clean) return;
    setTaskTitle((prev) => prev || suggestTasksForGoal(clean)[0] || '');
    setStep('task');
  };

  return (
    <div
      className="backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('onb.aria')}
    >
      <div className="dialog-pop card w-full max-w-sm px-6 py-7 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-cream ring-1 ring-line bg-ink/40">
          {step === 'goal' && (
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4.5" />
              <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
            </svg>
          )}
          {step === 'task' && (
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M13.5 12.5l2.5 2.5 4-4.5" />
            </svg>
          )}
          {step === 'start' && (
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
            </svg>
          )}
        </div>

        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-cream">
          {step === 'start' ? taskTitle.trim() || goalTitle.trim() : t('onb.qs.title')}
        </h1>

        {step === 'goal' && (
          <>
            <p className="mt-2 text-[13px] leading-relaxed text-sage">{t('onb.qs.hint')}</p>
            <input
              className="mono-field mono-field-ink mt-4"
              type="text"
              value={goalTitle}
              maxLength={80}
              placeholder={t('onb.qs.ph')}
              aria-label={t('onb.qs.title')}
              autoComplete="off"
              onChange={(e) => setGoalTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') goTask();
              }}
            />
          </>
        )}

        {step === 'task' && (
          <>
            <p className="mt-2 text-[13px] leading-relaxed text-sage">{t('onb.qs.task')}</p>
            <input
              className="mono-field mono-field-ink mt-4"
              type="text"
              value={taskTitle}
              maxLength={80}
              aria-label={t('onb.qs.task')}
              autoComplete="off"
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && taskTitle.trim()) setStep('start');
              }}
            />
          </>
        )}

        {step === 'start' && (
          <p className="mt-2 text-[13px] leading-relaxed text-sage">
            {goalTitle.trim()} → {taskTitle.trim()}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {ORDER.map((s, i) => (
            <span
              key={s}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 22 : 6,
                background: i === idx ? 'var(--accent)' : 'var(--color-line)',
              }}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {step === 'goal' && (
            <button
              onClick={onDone}
              className="press btn-ghost rounded-lg px-4 py-2 font-mono text-[12px]"
            >
              {t('onb.skip')}
            </button>
          )}
          {step !== 'goal' && (
            <button
              onClick={() => setStep(step === 'start' ? 'task' : 'goal')}
              className="press btn-ghost rounded-lg px-4 py-2 font-mono text-[12px]"
            >
              {t('onb.qs.back')}
            </button>
          )}
          {step === 'goal' && (
            <button
              onClick={goTask}
              disabled={!goalTitle.trim()}
              className="press btn-accent rounded-lg px-6 py-2 font-display text-[13px] font-bold disabled:opacity-40"
            >
              {t('onb.next')}
            </button>
          )}
          {step === 'task' && (
            <button
              onClick={() => taskTitle.trim() && setStep('start')}
              disabled={!taskTitle.trim()}
              className="press btn-accent rounded-lg px-6 py-2 font-display text-[13px] font-bold disabled:opacity-40"
            >
              {t('onb.qs.use')}
            </button>
          )}
          {step === 'start' && (
            <button
              onClick={() => onQuickStart(goalTitle.trim(), taskTitle.trim())}
              className="press btn-accent rounded-lg px-6 py-2 font-display text-[13px] font-bold"
            >
              {t('onb.qs.start')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
