import { LOCALES } from '../lib/i18n';
import { useI18n } from '../lib/i18n/LocaleContext';

/**
 * Interface language picker (Faza 5 i18n): one-line description and native
 * language names — no mixed-language surfaces. The Settings group supplies
 * the title. Applies instantly and persists locally (moneo:locale, never synced).
 */
export default function LanguageCard() {
  const { t, locale, setLocale } = useI18n();
  return (
    <div className="mono-lang">
      <p className="mono-meta">{t('settings.langBody')}</p>
      <div className="mono-lang-grid" role="group" aria-label={t('settings.langAria')}>
        {LOCALES.map((l) => (
          <button
            key={l.id}
            type="button"
            className="mono-chip"
            onClick={() => setLocale(l.id)}
            aria-pressed={l.id === locale}
            lang={l.tag}
          >
            {l.native}
          </button>
        ))}
      </div>
    </div>
  );
}
