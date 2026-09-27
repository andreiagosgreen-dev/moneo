import { useState } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import { getSupabaseAccessToken, resolveCustomerPortalUrl } from '../lib/billing/lemonSqueezy';
import { openExternal } from '../lib/links';

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

  const open = async () => {
    if (busy) return;
    setBusy(true);
    const url = await resolveCustomerPortalUrl(getSupabaseAccessToken);
    setBusy(false);
    // The await can cost the click's popup permission — same-tab instead.
    if (!openExternal(url)) window.location.assign(url);
  };

  return (
    <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-cream">{t('pay.manage')}</div>
          <div className="mt-0.5 truncate text-[11px] text-faint">{t('pay.manageTitle')}</div>
        </div>
        <button
          onClick={() => void open()}
          disabled={busy}
          className="press btn-ghost flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 font-mono text-[12px] disabled:opacity-50"
        >
          {busy ? <Spinner /> : null}
          {t('pay.manage')}
        </button>
      </div>
    </div>
  );
}
