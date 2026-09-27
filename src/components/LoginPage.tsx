import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import BrandMark from './BrandMark';
import AuthForm from './account/AuthForm';
import GoogleSignInButton from './account/GoogleSignInButton';
import LegalInline from './legal/LegalInline';
import MonoLegalLinks from '../mono/MonoLegalLinks';
import { useAuth } from '../lib/authProvider';
import { useI18n } from '../lib/i18n/LocaleContext';
import { UPGRADE_PARAM, parsePaidPlan, pricingPathForUpgrade } from '../lib/billing/upgradeIntent';

/**
 * Dedicated full-page auth screen — email/password (shared AuthForm) plus
 * Google OAuth. Redirects once a session lands, whether from the form or
 * from the OAuth round-trip (Supabase's client already parses the session
 * out of the redirect URL; authController.init() picks it up): back to
 * /pricing with the chosen plan when the visitor came from an upgrade
 * button, otherwise to "/".
 */
export default function LoginPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const upgradePlan = parsePaidPlan(searchParams.get(UPGRADE_PARAM));

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    navigate(upgradePlan ? pricingPathForUpgrade(upgradePlan) : '/', { replace: true });
  }, [auth.status, navigate, upgradePlan]);

  const oauthReturn = upgradePlan
    ? `${window.location.origin}/login?${UPGRADE_PARAM}=${upgradePlan}`
    : `${window.location.origin}/login`;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="bg-glow bg-glow-focus is-on" aria-hidden />
      <div className="bg-grid" aria-hidden />
      <div className="bg-grain" aria-hidden />

      <div className="card dialog-pop relative z-10 w-full max-w-sm px-7 py-8">
        <div className="flex flex-col items-center text-center">
          <BrandMark size={36} />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-cream">
            {t('login.title')}
          </h1>
          <p className="mt-1.5 text-[13px] text-faint">{t('login.subtitle')}</p>
          {upgradePlan && (
            <p
              role="status"
              className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-[12px] font-semibold text-accent"
            >
              {t('pay.signin')}
            </p>
          )}
        </div>

        <div className="mt-6">
          <GoogleSignInButton redirectTo={oauthReturn} />
        </div>

        <div className="my-5 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {t('auth.orDivider')}
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <AuthForm />

        <p className="mt-4 text-center text-[12px] leading-relaxed text-faint">
          <LegalInline
            text={t('legal.agree')}
            docLabels={{
              terms: t('legal.termsLink'),
              privacy: t('legal.privacyLink'),
              refund: t('legal.refundLink'),
            }}
            linkClassName="font-semibold text-sage underline underline-offset-2 hover:text-cream"
          />
        </p>

        <p className="mt-6 text-center">
          <Link to="/" className="text-[12px] font-semibold text-faint hover:text-sage">
            {t('login.backToApp')}
          </Link>
        </p>
        <MonoLegalLinks className="mt-4 justify-center" />
      </div>
    </div>
  );
}
