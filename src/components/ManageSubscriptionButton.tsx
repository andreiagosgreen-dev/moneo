import { useState } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import {
  getSupabaseAccessToken,
  requestCustomerPortalUrl,
} from '../lib/billing/lemonSqueezy';

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
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Self-serve billing via the Lemon Squeezy Customer Portal.
 * The Worker issues a pre-signed portal URL (API key stays server-side);
 * cancel, upgrade and downgrade all happen inside that portal — no manual
 * support, no custom billing mutations.
 */
export default function ManageSubscriptionButton() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await requestCustomerPortalUrl(getSupabaseAccessToken);
    setBusy(false);
    if (res.ok && res.url) {
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } else {
      setError(t('pay.portalError'));
    }
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
      {error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-tomato">
          {error}
        </p>
      )}
    </div>
  );
}
