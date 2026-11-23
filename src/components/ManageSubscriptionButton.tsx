import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n/LocaleContext';
import { getSupabaseAccessToken, resolveCustomerPortalUrl } from '../lib/billing/lemonSqueezy';
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

/**
 * Self-serve billing via the Lemon Squeezy Customer Portal.
 * The Worker issues a pre-signed portal URL when it holds the API key;
 * otherwise the store's email-login portal opens. Cancel, upgrade and
 * downgrade all happen inside that portal — no custom billing mutations.
 */
export default function ManageSubscriptionButton() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const portalButton = useRef<HTMLButtonElement>(null);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    const url = await resolveCustomerPortalUrl(getSupabaseAccessToken);
    if (!portalButton.current?.isConnected) return;
    setBusy(false);
    // The await can cost the click's popup permission — same tab then.
    openPaymentPage(url);
  };

  return (
    <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-cream">{t('pay.manage')}</div>
          <div className="mt-0.5 text-[12px] leading-relaxed text-sage">{t('pay.manageTitle')}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={portalButton}
            type="button"
            onClick={() => void open()}
            disabled={busy}
            aria-busy={busy}
            className="press btn-ghost inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-mono text-[12px] disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
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
  );
}
