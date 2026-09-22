import { Link } from 'react-router-dom';
import BrandMark from './BrandMark';
import PricingCard from './PricingCard';
import { useI18n } from '../lib/i18n/LocaleContext';

/**
 * Public pricing page — reachable without signing in, so a link can be
 * shared or referenced from marketing before a visitor has an account.
 * Reuses PricingCard as-is (already handles the "not signed in yet" case
 * by prompting sign-in before checkout) rather than duplicating plan/
 * checkout logic.
 */
export default function PricingPage() {
  const { t } = useI18n();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="bg-glow bg-glow-focus is-on" aria-hidden />
      <div className="bg-grid" aria-hidden />
      <div className="bg-grain" aria-hidden />

      <header className="relative z-10 mx-auto flex max-w-2xl items-center gap-3 px-4 pt-8 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label={t('nav.home')}>
          <BrandMark size={26} />
        </Link>
        <Link
          to="/"
          className="press btn-ghost ml-auto rounded-xl px-3 py-1.5 text-[12px] font-semibold"
        >
          {t('login.backToApp')}
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-cream">
            {t('pricingPage.title')}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-faint">
            {t('pricingPage.subtitle')}
          </p>
        </div>

        <div className="mt-8">
          <PricingCard />
        </div>
      </main>
    </div>
  );
}
