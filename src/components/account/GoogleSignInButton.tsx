import { useState } from 'react';
import { useAuth } from '../../lib/authProvider';
import { useI18n } from '../../lib/i18n/LocaleContext';

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

/**
 * Shared "Continue with Google" control — used by both the full /login page
 * and the quick Sync modal, so Google auth is reachable from wherever a user
 * actually starts (Faza 8 only wired it into /login, which nobody visits
 * directly from the nav's "Sync" button).
 */
export default function GoogleSignInButton({ redirectTo }: { redirectTo: string }) {
  const { t } = useI18n();
  const auth = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await auth.signInWithGoogle(redirectTo);
    // On success the browser navigates away to Google — nothing left to do.
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
    }
  };

  return (
    <>
      <button
        onClick={() => void handleClick()}
        disabled={busy}
        className="press btn-ghost flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-line text-sm font-semibold disabled:opacity-60"
      >
        <GoogleIcon />
        {t('auth.continueWithGoogle')}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-[12px] font-medium text-tomato">
          {error}
        </p>
      )}
    </>
  );
}
