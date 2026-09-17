import { overcommitment } from '../lib/ritual';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  plannedMin: number;
  availableMin: number;
}

/**
 * Calm amber flag shown only when estimates exceed real capacity.
 * Returns null when the day fits — callers render their own quiet caption.
 */
export function OvercommitWarning({ plannedMin, availableMin }: Props) {
  const { t, fmtDur } = useI18n();
  const o = overcommitment(plannedMin, availableMin);
  if (!o.over) return null;
  return (
    <div
      className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3"
      role="alert"
      aria-label={t('overcommit.aria')}
    >
      <p className="text-[13px] font-semibold text-cream">
        {t('overcommit.title', { dur: fmtDur(o.excessMin) })}
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-sage">
        {t('overcommit.body', { p: fmtDur(o.plannedMin), a: fmtDur(o.availableMin) })}
      </p>
    </div>
  );
}
