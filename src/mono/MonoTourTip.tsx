import MonoBtn from './MonoBtn';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TourTip } from '../lib/trialTour';

/** Today, days 2–4 of the free Pro trial: one thing worth trying today. */
export default function MonoTourTip({
  tip,
  onGo,
  onDismiss,
}: {
  tip: TourTip;
  onGo: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  return (
    <section className="mono-card mono-tour" aria-labelledby="tour-title" data-testid="tour-tip">
      <p className="mono-eyebrow">{t(`tour.${tip}.day` as const)}</p>
      <h2 className="mono-h3" id="tour-title">
        {t(`tour.${tip}.t` as const)}
      </h2>
      <p className="mono-meta">{t(`tour.${tip}.b` as const)}</p>
      <div className="mono-first-ctas">
        <MonoBtn type="button" onClick={onGo}>
          {t(`tour.${tip}.cta` as const)}
        </MonoBtn>
        <MonoBtn type="button" variant="ghost" onClick={onDismiss}>
          {t('tour.later')}
        </MonoBtn>
      </div>
    </section>
  );
}
