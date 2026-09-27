import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MonoBtn from '../mono/MonoBtn';
import MonoCard from '../mono/MonoCard';
import { useAuth } from '../lib/authProvider';
import { useI18n } from '../lib/i18n/LocaleContext';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../lib/passwordReset';

/**
 * Landing page of the Supabase password-reset email. The Supabase client
 * turns the link's recovery token into a session on boot, so by the time
 * auth settles the user is signed in and only needs to pick a new password.
 * No session → the link is invalid or expired.
 */
export default function ResetPasswordPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const save = async () => {
    if (busy) return;
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setError(
        problem === 'short'
          ? t('auth.newPasswordShort', { n: MIN_PASSWORD_LENGTH })
          : t('auth.newPasswordMismatch'),
      );
      return;
    }
    setBusy(true);
    setError('');
    const res = await auth.updatePassword(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setPassword('');
    setConfirm('');
    setDone(true);
  };

  let body;
  if (auth.status === 'loading') {
    body = <p className="mono-meta">{t('auth.resetLinkChecking')}</p>;
  } else if (done) {
    body = (
      <>
        <p role="status" className="mono-meta">
          {t('auth.newPasswordDone')}
        </p>
        <MonoBtn block onClick={() => navigate('/', { replace: true })}>
          {t('login.backToApp')}
        </MonoBtn>
      </>
    );
  } else if (auth.status !== 'authenticated') {
    body = (
      <>
        <p role="alert" className="mono-meta">
          {t('auth.resetLinkInvalid')}
        </p>
        <Link to="/login" className="mono-btn mono-btn-primary mono-btn-block">
          {t('auth.signIn')}
        </Link>
      </>
    );
  } else {
    body = (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {auth.user?.email && <p className="mono-meta">{auth.user.email}</p>}
        <label className="block">
          <span className="mono-eyebrow">{t('auth.newPasswordLabel')}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mono-field mt-1.5"
          />
        </label>
        <label className="block">
          <span className="mono-eyebrow">{t('auth.newPasswordConfirm')}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mono-field mt-1.5"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="text-[14px] font-medium"
            style={{ color: 'var(--mono-danger)' }}
          >
            {error}
          </p>
        )}
        <MonoBtn type="submit" block disabled={busy || password.length === 0}>
          {t('auth.newPasswordSave')}
        </MonoBtn>
      </form>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: 'var(--mono-bg)', color: 'var(--mono-fg)' }}
    >
      <div className="w-full max-w-sm">
        <MonoCard>
          <p className="mono-eyebrow">Moneo</p>
          <h1 className="mono-h1">{t('auth.newPasswordTitle')}</h1>
          <div className="mt-5 flex flex-col gap-4">{body}</div>
        </MonoCard>
      </div>
    </div>
  );
}
