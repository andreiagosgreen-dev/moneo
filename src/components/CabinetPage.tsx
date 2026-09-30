import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BrandMark from './BrandMark';
import NotificationsSettings from './NotificationsSettings';
import SyncPanel from './account/SyncPanel';
import GoogleCalendarConnect from './account/GoogleCalendarConnect';
import FocusBuddy from './account/FocusBuddy';
import { useAuth } from '../lib/authProvider';
import { useI18n } from '../lib/i18n/LocaleContext';
import {
  hasRenewingSubscription,
  isCancelledButActive,
  type SubscriptionInfo,
} from '../lib/cloud/subscriptionRepository';
import { LEMON_MY_ORDERS_URL, buildCustomerPortalUrl } from '../lib/billing/lemonSqueezy';
import ManageSubscriptionButton from './ManageSubscriptionButton';
import { computeXp } from '../lib/xp';
import { computeBadges } from '../lib/badges';
import { loadHistory } from '../lib/store';
import { loadTasks } from '../lib/tasks';
import { loadHabitLog } from '../lib/habits';
import { loadPhases } from '../lib/waterfall';
import { loadProjects } from '../lib/projects';
import { loadAtmosphere, resolveAtmosphere } from '../mono/atmosphere';
import MonoCloudSync from '../mono/MonoCloudSync';

const MonoRankCard = lazy(() => import('../mono/MonoRankCard'));
const MonoRankDiscount = lazy(() => import('../mono/MonoRankDiscount'));
const PricingCard = lazy(() => import('./PricingCard'));

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The personal Cabinet — replaces the cramped "Sync" modal with a proper
 * page: identity, sync status, subscription and notification preferences,
 * sign-out and account deletion. Reuses AccountButton's former SyncPanel
 * and the existing PricingCard/NotificationsSettings rather than
 * duplicating any of that logic.
 */
export default function CabinetPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const portalUrl = buildCustomerPortalUrl();
  const { xp, badges } = useMemo(() => {
    const input = {
      history: loadHistory(),
      tasks: loadTasks(),
      habitLog: loadHabitLog(),
      phases: loadPhases(),
      projects: loadProjects(),
    };
    const breakdown = computeXp(input);
    return { xp: breakdown, badges: computeBadges({ ...input, totalXp: breakdown.total }) };
  }, []);

  // Lemon's confirmation "Button link" points at /account?billing=success
  // (set per product in the Lemon dashboard). The webhook may land slightly
  // later; the focus/visibility refresh in useAuth covers that.
  const refreshSubscription = auth.refreshSubscription;
  useEffect(() => {
    if (searchParams.get('billing') !== 'success') return;
    void refreshSubscription();
    const next = new URLSearchParams(searchParams);
    next.delete('billing');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, refreshSubscription]);

  const planLabel = (id: SubscriptionInfo['planId']) => {
    if (id === 'pro-monthly') return t('account.plan.pro-monthly');
    if (id === 'pro-yearly') return t('account.plan.pro-yearly');
    return t('account.plan.free');
  };

  if (auth.status !== 'authenticated' || !auth.user) {
    return (
      <div
        className="atm-root mono-public flex min-h-screen items-center justify-center px-4"
        data-atmosphere={resolveAtmosphere(loadAtmosphere(), auth.isPro)}
      >
        <div className="card px-7 py-8 text-center">
          <p className="text-sm text-faint">
            {auth.status === 'loading' ? t('account.checking') : t('cabinet.subtitle')}
          </p>
          {auth.status !== 'loading' && (
            <Link
              to="/login"
              className="btn-accent press mt-4 inline-block rounded-xl px-5 py-2.5 font-display text-sm font-bold"
            >
              {t('auth.signIn')}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const user = auth.user;

  return (
    <div
      className="atm-root mono-public relative min-h-screen overflow-hidden"
      data-atmosphere={resolveAtmosphere(loadAtmosphere(), auth.isPro)}
    >
      <div className="bg-grid" aria-hidden />
      <div className="bg-grain" aria-hidden />

      <header className="relative z-10 mx-auto flex max-w-2xl items-center gap-3 px-4 pt-8 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label={t('nav.home')}>
          <BrandMark size={26} />
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('cabinet.title')}
          </h1>
          <p className="text-[12px] text-faint">{t('cabinet.subtitle')}</p>
        </div>
        <Link
          to="/"
          className="press btn-ghost ml-auto rounded-xl px-3 py-1.5 text-[12px] font-semibold"
        >
          {t('login.backToApp')}
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <section className="card px-6 py-5">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            {t('cabinet.identity')}
          </h2>
          <div className="mt-3 rounded-xl border border-line bg-ink/50 px-4 py-3">
            <div className="truncate text-sm font-semibold text-cream">
              {user.email ?? user.userId}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 font-mono text-[11px] text-faint">
              <span>{t('account.timezone')}</span>
              <span className="truncate text-sage">{auth.timezone}</span>
            </div>
          </div>
        </section>

        <div
          className="atm-root mono-rank-host"
          data-atmosphere={resolveAtmosphere(loadAtmosphere(), auth.isPro)}
        >
          <Suspense fallback={null}>
            <MonoRankCard xp={xp} badges={badges} />
          </Suspense>
        </div>

        <Suspense fallback={null}>
          <MonoRankDiscount />
        </Suspense>

        <section className="card px-6 py-5">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            {t('account.subscriptionStatus')}
          </h2>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/50 px-4 py-3">
            <span className="text-sm font-semibold text-cream">
              {auth.subscription.isPro
                ? planLabel(auth.subscription.planId)
                : t('account.plan.free')}
            </span>
            {auth.subscription.isPro && auth.subscription.currentPeriodEnd && (
              <span className="font-mono text-[11px] text-faint">
                {t(
                  isCancelledButActive(auth.subscription)
                    ? 'account.cancelledUntil'
                    : 'account.renews',
                  {
                    date: new Date(auth.subscription.currentPeriodEnd).toLocaleDateString(),
                  },
                )}
              </span>
            )}
          </div>
          {/* Portal is Lemon-paid only — complimentary Pro keeps Free planId. */}
          {auth.subscription.planId !== 'free' && (
            <div className="mt-3">
              <ManageSubscriptionButton />
            </div>
          )}
          <div className="mt-4">
            <Suspense fallback={null}>
              <PricingCard />
            </Suspense>
          </div>
        </section>

        <section className="card px-6 py-5">
          <SyncPanel userId={user.userId} />
        </section>

        <div
          className="atm-root mono-rank-host"
          data-atmosphere={resolveAtmosphere(loadAtmosphere(), auth.isPro)}
        >
          <MonoCloudSync isPro={auth.isPro} onAccountPage />
        </div>

        <section className="card px-6 py-5">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            {t('calendar.connect.sectionTitle')}
          </h2>
          <div className="mt-3">
            <GoogleCalendarConnect isPro={auth.isPro} />
          </div>
        </section>

        <section className="card px-6 py-5">
          <FocusBuddy isPro={auth.isPro} />
        </section>

        <section className="card px-6 py-5">
          <NotificationsSettings />
        </section>

        {error && (
          <p role="alert" className="text-[12px] font-medium text-tomato">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <button
            onClick={() => {
              setBusy(true);
              void auth.signOut().finally(() => setBusy(false));
            }}
            disabled={busy}
            className="press btn-ghost flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
          >
            {busy ? <Spinner /> : null}
            {t('account.signOut')}
          </button>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="press btn-ghost flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-tomato hover:text-tomato/80"
            >
              {t('account.deleteAccount')}
            </button>
          ) : (
            <div className="rounded-xl border border-tomato/30 bg-tomato/5 px-4 py-3">
              <p className="text-[12px] font-semibold text-tomato">
                {t('account.deleteConfirmTitle')}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-sage">
                {t('account.deleteConfirmBody')}
              </p>
              {hasRenewingSubscription(auth.subscription) && (
                <p
                  role="note"
                  className="mt-2 rounded-lg border border-tomato/30 px-3 py-2 text-[11px] leading-relaxed text-cream"
                >
                  {t('account.deleteSubWarning')}{' '}
                  <a
                    href={portalUrl ?? LEMON_MY_ORDERS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-tomato underline underline-offset-2"
                  >
                    {t('account.deleteSubPortal')}
                  </a>
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={busy}
                  className="press btn-ghost flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold"
                >
                  {t('account.cancel')}
                </button>
                <button
                  onClick={async () => {
                    setBusy(true);
                    const result = await auth.deleteAccount();
                    setBusy(false);
                    if (!result.ok) {
                      setError(result.message);
                      setShowDeleteConfirm(false);
                    }
                  }}
                  disabled={busy}
                  className="press btn-accent flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-tomato text-sm font-semibold hover:bg-tomato/90"
                >
                  {busy ? <Spinner /> : null}
                  {t('account.deleteAccount')}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
