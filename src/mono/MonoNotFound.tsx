import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n/LocaleContext';
import MonoCard from './MonoCard';

/** Router catch-all for paths outside the known route list (Worker serves them as 404). */
export default function MonoNotFound() {
  const { t } = useI18n();
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: 'var(--mono-bg)', color: 'var(--mono-fg)' }}
    >
      <main className="w-full max-w-sm" data-testid="mono-not-found">
        <MonoCard>
          <p className="mono-eyebrow">404</p>
          <h1 className="mono-h1">{t('mono.notFound.title')}</h1>
          <p className="mono-meta mt-3">{t('mono.notFound.body')}</p>
          <Link to="/" className="mono-btn mono-btn-primary mono-btn-block mt-6 no-underline">
            {t('mono.notFound.back')}
          </Link>
        </MonoCard>
      </main>
    </div>
  );
}
