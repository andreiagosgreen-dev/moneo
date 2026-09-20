import { LOCALES } from '../lib/i18n';
import { useI18n } from '../lib/i18n/LocaleContext';

/**
 * Interface language picker (Faza 5 i18n). Self-contained: title, one-line
 * description and native language names — no mixed-language surfaces.
 * Applies instantly and persists locally (moneo:locale, never synced).
 */
export default function LanguageCard() {
  const { t, locale, setLocale } = useI18n();
  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('settings.langAria')}>
      <h2 className="font-display text-xl font-bold tracking-tight text-cream">
        {t('settings.langTitle')}
      </h2>
      <p className="mt-1 text-[12px] leading-relaxed text-faint">{t('settings.langBody')}</p>
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label={t('settings.langAria')}>
        {LOCALES.map((l) => {
          const active = l.id === locale;
          return (
            <button
              key={l.id}
              onClick={() => setLocale(l.id)}
              aria-pressed={active}
              lang={l.tag}
              className={`press rounded-xl px-4 py-2.5 text-left text-[13px] font-semibold ring-1 ring-inset transition-colors ${
                active
                  ? 'bg-accent/10 text-cream ring-accent/50'
                  : 'bg-ink/40 text-sage ring-line hover:text-cream'
              }`}
            >
              {l.native}
            </button>
          );
        })}
      </div>
    </section>
  );
}
