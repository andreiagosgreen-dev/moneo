import { useCallback, useEffect, useRef, useState } from 'react';
import BrandMark from './BrandMark';
import PricingCard from './PricingCard';
import NotificationsSettings from './NotificationsSettings';
import { useAuth } from '../lib/authProvider';
import { loadSyncState, onSyncStateChange } from '../lib/sync/syncState';
import { runSync } from '../lib/sync/syncEngine';
import { createSupabaseSyncRepos, createLocalSyncIO } from '../lib/sync/syncRepos';

/**
 * Minimal account entry — a small header control, never a navbar.
 * Anonymous: "Sync". Authenticated: the account email. While auth is
 * resolving it shows a quiet spinner and never blocks the timer.
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

/** Relative stamp for "Last synced". */
function fmtSyncedAt(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  const d = new Date(ts);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Sync status + explicit first-sync consent.
 * Mounted only while the account dialog is open — opening it (when already
 * initialized) performs one light sync; reconnecting to the network retries.
 * Never runs on timer ticks. Local data is never gated on sync success.
 */
function SyncPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [syncState, setSyncState] = useState(loadSyncState);
  const [phase, setPhase] = useState<'idle' | 'syncing'>('idle');
  const [lastError, setLastError] = useState('');

  useEffect(() => onSyncStateChange(() => setSyncState(loadSyncState())), []);

  const doSync = useCallback(
    async (consented: boolean) => {
      setPhase('syncing');
      setLastError('');
      const outcome = await runSync({
        userId,
        consented,
        repos: createSupabaseSyncRepos(),
        local: createLocalSyncIO(),
      });
      setPhase('idle');
      if (!outcome.ok) {
        setLastError(
          outcome.stage === 'pull' || outcome.stage === 'push'
            ? 'Sync failed — your local data is safe. Try again.'
            : (outcome.error ?? 'Sync failed.'),
        );
      }
    },
    [userId],
  );

  useEffect(() => {
    if (loadSyncState().initialized) void doSync(false);
    const onOnline = () => {
      if (loadSyncState().initialized) void doSync(false);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!syncState.initialized) {
    return (
      <div className="rounded-xl border border-line bg-ink/50 px-4 py-4">
        <h3 className="font-display text-[15px] font-bold text-cream">Sync your Moneo data</h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-sage">
          Your local focus history, areas, intentions and settings can be saved to your account and
          synced across devices.
        </p>
        {lastError && (
          <p role="alert" className="mt-2 text-[12px] font-medium text-tomato">
            {lastError}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void doSync(true)}
            disabled={phase === 'syncing'}
            className="press btn-accent flex h-10 flex-1 items-center justify-center gap-2 rounded-xl font-display text-sm font-bold disabled:opacity-60"
          >
            {phase === 'syncing' ? <Spinner /> : null}
            Sync now
          </button>
          <button
            onClick={onClose}
            className="press btn-ghost h-10 rounded-xl px-4 text-sm font-semibold"
          >
            Not now
          </button>
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-faint">
          Only sessions, areas and settings sync — intention drafts and timer state never leave this
          device.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-cream">
            {phase === 'syncing' ? 'Syncing…' : lastError ? 'Sync failed' : 'Synced'}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-faint">
            {phase === 'syncing'
              ? 'comparing with your account'
              : lastError
                ? lastError
                : syncState.lastSuccessfulSyncAt
                  ? `Last synced ${fmtSyncedAt(syncState.lastSuccessfulSyncAt)}`
                  : 'Sync enabled'}
          </div>
        </div>
        <button
          onClick={() => void doSync(false)}
          disabled={phase === 'syncing'}
          className="press btn-ghost flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 font-mono text-[12px] disabled:opacity-50"
          aria-label="Sync now"
        >
          {phase === 'syncing' ? <Spinner /> : null}
          Sync now
        </button>
      </div>
    </div>
  );
}

export default function AccountButton() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setError('');
    setNote('');
    setPassword('');
    setShowDeleteConfirm(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    emailRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNote('');
    const res =
      tab === 'signin' ? await auth.signIn(email, password) : await auth.signUp(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    if (res.note) setNote(res.note);
    setPassword('');
  };

  const authenticated = auth.status === 'authenticated' && auth.user;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={auth.status === 'loading'}
        className="press btn-ghost flex h-9 items-center gap-2 rounded-full px-3 font-mono text-[12px]"
        aria-label={
          auth.status === 'loading'
            ? 'Checking account'
            : authenticated
              ? 'Open account'
              : 'Open sync and account'
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
            {auth.user!.email ?? 'Account'}
          </span>
        ) : (
          <span className="hidden text-sage min-[400px]:inline">Sync</span>
        )}
      </button>

      {open && (
        <div
          className="backdrop-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-4 sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-dialog-title"
            className="card dialog-pop w-full max-w-sm px-6 py-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <BrandMark size={26} />
                <div>
                  <h2
                    id="account-dialog-title"
                    className="font-display text-lg font-bold leading-none tracking-tight text-cream"
                  >
                    {authenticated ? 'Your account' : 'Moneo Account'}
                  </h2>
                  <p className="mt-1 text-[12px] text-faint">
                    {authenticated ? 'Signed in' : 'Sync your focus across devices.'}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                className="press btn-ghost flex h-8 w-8 items-center justify-center rounded-lg"
                aria-label="Close account dialog"
              >
                <CloseIcon />
              </button>
            </div>

            {authenticated ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
                  <div className="truncate text-sm font-semibold text-cream">
                    {auth.user!.email ?? auth.user!.userId}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3 font-mono text-[11px] text-faint">
                    <span>timezone</span>
                    <span className="truncate text-sage">{auth.timezone}</span>
                  </div>
                </div>
                <SyncPanel userId={auth.user!.userId} onClose={close} />
                <PricingCard />
                <NotificationsSettings />
                <p className="text-[12px] leading-relaxed text-faint">
                  Without an account, everything stays on this device. Sync is optional and never
                  uploads anything until you choose to.
                </p>
                <button
                  onClick={() => {
                    setBusy(true);
                    void auth.signOut().finally(() => {
                      setBusy(false);
                      close();
                    });
                  }}
                  disabled={busy}
                  className="press btn-ghost flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                >
                  {busy ? <Spinner /> : null}
                  Sign out
                </button>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="press btn-ghost flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-tomato hover:text-tomato/80"
                  >
                    Delete account
                  </button>
                ) : (
                  <div className="rounded-xl border border-tomato/30 bg-tomato/5 px-4 py-3">
                    <p className="text-[12px] font-semibold text-tomato">Are you sure?</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-sage">
                      This will permanently delete all your synced data (sessions, areas, settings).
                      Your auth account will be signed out.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={busy}
                        className="press btn-ghost flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          setBusy(true);
                          const result = await auth.deleteAccount();
                          setBusy(false);
                          if (result.ok) {
                            close();
                          } else {
                            setError(result.message);
                            setShowDeleteConfirm(false);
                          }
                        }}
                        disabled={busy}
                        className="press btn-accent flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold bg-tomato hover:bg-tomato/90"
                      >
                        {busy ? <Spinner /> : null}
                        Delete data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* mode tabs */}
                <div
                  className="relative mt-5 grid grid-cols-2 rounded-full border border-line bg-ink/60 p-1"
                  role="tablist"
                  aria-label="Account mode"
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
                  {(['signin', 'signup'] as const).map((t) => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => {
                        setTab(t);
                        setError('');
                        setNote('');
                      }}
                      className={`press relative z-10 rounded-full py-2 font-display text-sm font-semibold ${
                        tab === t ? 'text-cream' : 'text-faint hover:text-sage'
                      }`}
                    >
                      {t === 'signin' ? 'Sign in' : 'Create account'}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label
                      htmlFor="account-email"
                      className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint"
                    >
                      Email
                    </label>
                    <input
                      ref={emailRef}
                      id="account-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-line bg-ink/60 px-3 text-sm text-cream transition-colors placeholder:text-faint focus:[border-color:var(--accent)] focus:outline-none"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="account-password"
                      className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint"
                    >
                      Password
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
                    disabled={busy || email.trim().length === 0 || password.length === 0}
                    className="press btn-accent flex h-11 w-full items-center justify-center gap-2 rounded-xl font-display text-[15px] font-bold disabled:opacity-40"
                  >
                    {busy ? <Spinner /> : null}
                    {tab === 'signin' ? 'Sign in' : 'Create account'}
                  </button>

                  <p className="pt-1 text-[11px] leading-relaxed text-faint">
                    Local-first: your sessions, intentions and areas stay on this device. Signing in
                    creates your Moneo profile; device sync stays opt-in — nothing is uploaded until
                    you enable it.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
