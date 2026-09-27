import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n/LocaleContext';
import { LEGAL_PATHS, SUPPORT_MAILTO } from '../lib/legal/seller';

interface Props {
  /** Prepend a Help link (Settings, More, legal pages). */
  showHelp?: boolean;
  className?: string;
}

/** Help · Terms · Privacy · Refund · Contact — one row, same everywhere. */
export default function MonoLegalLinks({ showHelp = false, className }: Props) {
  const { t } = useI18n();
  return (
    <nav
      className={className ? `mono-legal-links ${className}` : 'mono-legal-links'}
      aria-label={t('legal.nav')}
    >
      {showHelp && <Link to="/help">{t('foot.help')}</Link>}
      <Link to={LEGAL_PATHS.terms}>{t('foot.terms')}</Link>
      <Link to={LEGAL_PATHS.privacy}>{t('foot.privacy')}</Link>
      <Link to={LEGAL_PATHS.refund}>{t('foot.refund')}</Link>
      <a href={SUPPORT_MAILTO}>{t('foot.contact')}</a>
    </nav>
  );
}
