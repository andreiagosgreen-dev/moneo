import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/authProvider';
import { useI18n } from '../lib/i18n/LocaleContext';
import {
  getSupabaseAccessToken,
  requestSubscriptionAction,
  resolveCustomerPortalUrl,
  type SubscriptionAction,
} from '../lib/billing/lemonSqueezy';
import { openPaymentPage } from '../lib/links';

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

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Subscription management stays in Moneo. Card settings remain provider-hosted. */
export default function ManageSubscriptionButton() {
  const { t, tag } = useI18n();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<'provider' | SubscriptionAction | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [localEnd, setLocalEnd] = useState<string | null>(null);
  const [notice, setNotice] = useState<'cancelled' | 'resumed' | 'error' | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const status = localStatus ?? auth.subscription.status;
  const periodEnd = localEnd ? Date.parse(localEnd) : (auth.subscription.currentPeriodEnd ?? null);
  const cancelled = status === 'cancelled';
  const planLabel =
    auth.subscription.planId === 'pro-yearly'
      ? t('account.plan.pro-yearly')
      : t('account.plan.pro-monthly');
  const formattedEnd = periodEnd
    ? new Date(periodEnd).toLocaleDateString(tag, { dateStyle: 'medium' })
    : null;

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy]);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setConfirming(false);
    setNotice(null);
  };

  const openProviderSettings = async () => {
    if (busy) return;
    setBusy('provider');
    const url = await resolveCustomerPortalUrl(getSupabaseAccessToken);
    setBusy(null);
    openPaymentPage(url);
  };

  const updateSubscription = async (action: SubscriptionAction) => {
    if (busy) return;
    setBusy(action);
    setNotice(null);
    const result = await requestSubscriptionAction(action);
    setBusy(null);
    if (!result.ok) {
      setNotice('error');
      return;
    }
    setLocalStatus(result.status);
    setLocalEnd(result.endsAt);
    setConfirming(false);
    setNotice(action === 'cancel' ? 'cancelled' : 'resumed');
    await auth.refreshSubscription();
  };

  return (
    <>
      <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-cream">{t('pay.manage')}</div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-sage">
              {t('pay.manageTitle')}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="press btn-ghost inline-flex min-h-11 items-center rounded-lg px-3 font-mono text-[12px]"
            >
              {t('pay.manageAction')}
            </button>
            <Link
              to="/refund"
              className="press inline-flex min-h-11 items-center rounded-lg px-2 text-[12px] font-semibold text-cream underline underline-offset-2"
            >
              {t('pay.requestRefund')}
            </Link>
          </div>
        </div>
      </div>

      {open &&
        createPortal(
          <div
            className="backdrop-fade fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-sm sm:items-center"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="subscription-dialog-title"
              className="card dialog-pop my-6 w-full max-w-md px-5 py-5 sm:px-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mono-eyebrow">Moneo Pro</div>
                  <h2
                    id="subscription-dialog-title"
                    className="mt-1 font-display text-xl font-bold text-cream"
                  >
                    {t('pay.manageDialogTitle')}
                  </h2>
                </div>
                <button
                  ref={closeButton}
                  type="button"
                  onClick={close}
                  disabled={Boolean(busy)}
                  aria-label={t('pay.closeManageDialog')}
                  className="press btn-ghost flex h-10 w-10 shrink-0 items-center justify-center rounded-lg disabled:opacity-50"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="mt-5 rounded-xl border border-line bg-ink/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[12px] text-sage">{t('pay.currentPlan')}</span>
                  <strong className="text-sm text-cream">{planLabel}</strong>
                </div>
                {formattedEnd ? (
                  <div className="mt-3 flex items-center justify-between gap-4 border-t border-line pt-3">
                    <span className="text-[12px] text-sage">
                      {cancelled ? t('pay.proAccessUntil') : t('pay.nextRenewal')}
                    </span>
                    <strong className="text-right font-mono text-[12px] text-cream">
                      {formattedEnd}
                    </strong>
                  </div>
                ) : null}
              </div>

              {notice ? (
                <p
                  role={notice === 'error' ? 'alert' : 'status'}
                  className={`mt-4 rounded-lg border px-3 py-2 text-[12px] leading-relaxed ${
                    notice === 'error'
                      ? 'border-tomato/40 bg-tomato/10 text-tomato'
                      : 'border-mint/35 bg-mint/10 text-cream'
                  }`}
                >
                  {notice === 'cancelled'
                    ? t('pay.cancelledSuccess')
                    : notice === 'resumed'
                      ? t('pay.resumedSuccess')
                      : t('pay.subscriptionActionError')}
                </p>
              ) : null}

              {confirming ? (
                <div className="mt-4 rounded-xl border border-tomato/35 bg-tomato/5 p-4">
                  <h3 className="text-sm font-semibold text-cream">
                    {t('pay.cancelConfirmTitle')}
                  </h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-sage">
                    {formattedEnd
                      ? t('pay.cancelConfirmBodyDate', { date: formattedEnd })
                      : t('pay.cancelConfirmBody')}
                  </p>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      disabled={Boolean(busy)}
                      className="press btn-ghost min-h-11 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
                    >
                      {t('pay.keepSubscription')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateSubscription('cancel')}
                      disabled={Boolean(busy)}
                      aria-busy={busy === 'cancel'}
                      className="press inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-tomato/45 bg-tomato/10 px-4 text-sm font-semibold text-tomato disabled:opacity-50"
                    >
                      {busy === 'cancel' ? <Spinner /> : null}
                      {t('pay.confirmCancellation')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid gap-2">
                  {cancelled ? (
                    <button
                      type="button"
                      onClick={() => void updateSubscription('resume')}
                      disabled={Boolean(busy)}
                      aria-busy={busy === 'resume'}
                      className="press btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                    >
                      {busy === 'resume' ? <Spinner /> : null}
                      {t('pay.resumeSubscription')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      className="press btn-ghost min-h-11 rounded-xl px-4 text-sm font-semibold text-tomato"
                    >
                      {t('pay.cancelSubscription')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void openProviderSettings()}
                    disabled={Boolean(busy)}
                    aria-busy={busy === 'provider'}
                    className="press btn-ghost inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                  >
                    {busy === 'provider' ? <Spinner /> : null}
                    {t('pay.paymentSettings')}
                  </button>
                  <p className="px-2 text-center text-[11px] leading-relaxed text-faint">
                    {t('pay.paymentSettingsHint')}
                  </p>
                  <Link
                    to="/refund"
                    onClick={close}
                    className="press flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-cream underline underline-offset-2"
                  >
                    {t('pay.requestRefund')}
                  </Link>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
