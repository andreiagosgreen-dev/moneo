import { useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/LocaleContext';
import { useAuth } from '../../lib/authProvider';
import TurnstileWidget from './TurnstileWidget';
import { getTurnstileSiteKey } from '../../lib/turnstile';

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
 * Reusable email/password sign-in + sign-up form. Shared by the quick
 * AccountButton modal and the dedicated /login page — one implementation,
 * one place to fix bugs or add a provider.
 */
export default function AuthForm({ onAuthenticated }: { onAuthenticated?: () => void }) {
  const { t } = useI18n();
  const auth = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRequired = getTurnstileSiteKey() !== null;
  const emailRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNote('');
    const res =
      tab === 'signin'
        ? await auth.signIn(email, password, captchaToken ?? undefined)
        : await auth.signUp(email, password, captchaToken ?? undefined);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    if (res.note) setNote(res.note);
    setPassword('');
    setCaptchaToken(null);
    if (res.ok) onAuthenticated?.();
  };

  return (
    <>
      <div
        className="relative grid grid-cols-2 rounded-full border border-line bg-ink/60 p-1"
        role="tablist"
        aria-label={t('auth.modeLabel')}
      >
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)] rounded-full border transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(${tab === 'signin' ? 0 : 100}%)`,
            background: 'rgb(var(--accent-rgb) / 0.13)',
            borderColor: 'rgb(var(--accent-rgb) / 0.35)',
          }}
        />
        {(['signin', 'signup'] as const).map((tb) => (
          <button
            key={tb}
            role="tab"
            aria-selected={tab === tb}
            onClick={() => {
              setTab(tb);
              setError('');
              setNote('');
            }}
            className={`press relative z-10 rounded-full py-2 font-display text-sm font-semibold ${
              tab === tb ? 'text-cream' : 'text-faint hover:text-sage'
            }`}
          >
            {tb === 'signin' ? t('auth.signIn') : t('auth.createAccount')}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="account-email"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint"
          >
            {t('auth.emailLabel')}
          </label>
          <input
            ref={emailRef}
            id="account-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-line bg-ink/60 px-3 text-sm text-cream transition-colors placeholder:text-faint focus:[border-color:var(--accent)] focus:outline-none"
            placeholder={t('auth.emailPlaceholder')}
          />
        </div>
        <div>
          <label
            htmlFor="account-password"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint"
          >
            {t('auth.passwordLabel')}
          </label>
          <input
            id="account-password"
            type="password"
            autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
            }}
            className="mt-1.5 h-10 w-full rounded-xl border border-line bg-ink/60 px-3 text-sm text-cream transition-colors placeholder:text-faint focus:[border-color:var(--accent)] focus:outline-none"
            placeholder="••••••••"
          />
        </div>

        <TurnstileWidget onToken={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

        {error && (
          <p role="alert" className="text-[12px] font-medium text-tomato">
            {error}
          </p>
        )}
        {note && (
          <p role="status" className="text-[12px] font-medium text-sage">
            {note}
          </p>
        )}

        <button
          onClick={() => void submit()}
          disabled={
            busy ||
            email.trim().length === 0 ||
            password.length === 0 ||
            (captchaRequired && !captchaToken)
          }
          className="press btn-accent flex h-11 w-full items-center justify-center gap-2 rounded-xl font-display text-[15px] font-bold disabled:opacity-40"
        >
          {busy ? <Spinner /> : null}
          {tab === 'signin' ? t('auth.signIn') : t('auth.createAccount')}
        </button>

        <p className="pt-1 text-[11px] leading-relaxed text-faint">{t('auth.localFirstNote')}</p>
      </div>
    </>
  );
}
