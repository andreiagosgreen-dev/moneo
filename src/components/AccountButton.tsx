import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import BrandMark from './BrandMark';
import AuthForm from './account/AuthForm';
import GoogleSignInButton from './account/GoogleSignInButton';
import { useAuth } from '../lib/authProvider';
import { useI18n } from '../lib/i18n/LocaleContext';

/**
 * Minimal account entry — a small header control, never a navbar.
 * Anonymous: "Sync" (opens a quick sign-in modal). Authenticated: the
 * account email (navigates straight to the personal Cabinet page). While
 * auth is resolving it shows a quiet spinner and never blocks the timer.
 */

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

function CloudIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.5 19a4.5 4.5 0 0 0 .42-8.98 7 7 0 0 0-13.36 1.9A4 4 0 0 0 6 19h11.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function AccountButton() {
  const { t } = useI18n();
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const authenticated = auth.status === 'authenticated' && auth.user;

  return (
    <>
      <button
        onClick={() => (authenticated ? navigate('/account') : setOpen(true))}
        disabled={auth.status === 'loading'}
        className="press btn-ghost flex h-9 items-center gap-2 rounded-full px-3 font-mono text-[12px]"
        aria-label={
          auth.status === 'loading'
            ? t('account.checking')
            : authenticated
              ? t('account.openAccount')
              : t('account.openSyncAccount')
        }
      >
        {auth.status === 'loading' ? (
          <Spinner />
        ) : authenticated ? (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
        ) : (
          <CloudIcon />
        )}
        {auth.status === 'loading' ? (
          <span className="hidden text-faint min-[400px]:inline">…</span>
        ) : authenticated ? (
          <span className="hidden max-w-28 truncate text-cream min-[400px]:inline">
            {auth.user!.email ?? t('account.defaultName')}
          </span>
        ) : (
          <span className="hidden text-sage min-[400px]:inline">{t('account.sync')}</span>
        )}
      </button>

      {open &&
        !authenticated &&
        createPortal(
          <div
            className="backdrop-fade fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/70 p-4 sm:items-center"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-dialog-title"
              className="card dialog-pop my-8 w-full max-w-sm px-6 py-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <BrandMark size={26} />
                  <div>
                    <h2
                      id="account-dialog-title"
                      className="font-display text-lg font-bold leading-none tracking-tight text-cream"
                    >
                      {t('account.moneoAccount')}
                    </h2>
                    <p className="mt-1 text-[12px] text-faint">{t('account.syncAcrossDevices')}</p>
                  </div>
                </div>
                <button
                  onClick={close}
                  className="press btn-ghost flex h-8 w-8 items-center justify-center rounded-lg"
                  aria-label={t('account.closeDialog')}
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="mt-5">
                <GoogleSignInButton redirectTo={`${window.location.origin}/login`} />
              </div>

              <div className="my-5 flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                  {t('auth.orDivider')}
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <AuthForm onAuthenticated={close} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
