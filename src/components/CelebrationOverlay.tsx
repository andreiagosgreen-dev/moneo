import type { Celebration } from '../lib/celebrations';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  celebration: Celebration;
  onDone: () => void;
}

const ICON: Record<Celebration['kind'], string> = {
  firstGoalDone: '🎯',
  milestoneDone: '🏔️',
  focusDaysMilestone: '🔥',
};

/**
 * Rare, significant celebration (Faza 27) — never per-task. One instance,
 * invoked only for a first completed Goal, a completed Milestone, or a big
 * total-focus-days threshold crossed.
 */
export default function CelebrationOverlay({ celebration, onDone }: Props) {
  const { t } = useI18n();
  const title =
    celebration.kind === 'focusDaysMilestone'
      ? t('celebration.focusDays', { n: celebration.label })
      : celebration.kind === 'milestoneDone'
        ? t('celebration.milestoneDone', { name: celebration.label })
        : t('celebration.firstGoalDone', { name: celebration.label });

  return (
    <div
      className="backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onDone}
    >
      <div
        className="dialog-pop card w-full max-w-sm px-6 py-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl">{ICON[celebration.kind]}</div>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          {t('celebration.kicker')}
        </p>
        <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-cream">{title}</h2>
        <button
          onClick={onDone}
          className="press btn-accent mt-6 rounded-lg px-6 py-2 font-display text-[13px] font-bold"
        >
          {t('celebration.nice')}
        </button>
      </div>
    </div>
  );
}
