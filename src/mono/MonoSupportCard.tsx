import MonoCard from './MonoCard';
import MonoLegalLinks from './MonoLegalLinks';
import LegalInline from '../components/legal/LegalInline';
import { useI18n } from '../lib/i18n/LocaleContext';

/** Settings: support email + Help / legal links. */
export default function MonoSupportCard({ hideTitle = false }: { hideTitle?: boolean }) {
  const { t } = useI18n();
  return (
    <section aria-label={t('legal.cardTitle')}>
      <MonoCard>
        {hideTitle ? null : <p className="mono-eyebrow">{t('legal.cardTitle')}</p>}
        <p className="mono-meta">
          <LegalInline
            text={t('legal.contactBody')}
            docLabels={{
              terms: t('legal.termsLink'),
              privacy: t('legal.privacyLink'),
              refund: t('legal.refundLink'),
            }}
            linkClassName="mono-link"
          />
        </p>
        <MonoLegalLinks showHelp className="mono-legal-card-links" />
      </MonoCard>
    </section>
  );
}
