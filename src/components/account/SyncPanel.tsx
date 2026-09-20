import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/LocaleContext';
import { loadSyncState, onSyncStateChange } from '../../lib/sync/syncState';
import { runSync } from '../../lib/sync/syncEngine';
import { createSupabaseSyncRepos, createLocalSyncIO } from '../../lib/sync/syncRepos';

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
 * Sync status + explicit first-sync consent.
 * Mounted only while visible (account dialog / cabinet page) — opening it
 * (when already initialized) performs one light sync; reconnecting to the
 * network retries. Never runs on timer ticks. Local data is never gated on
 * sync success.
 */
export default function SyncPanel({
  userId,
  onDismiss,
}: {
  userId: string;
  onDismiss?: () => void;
}) {
  const { t } = useI18n();
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
            ? t('sync.failedRetry')
            : (outcome.error ?? t('sync.failed')),
        );
      }
    },
    [userId, t],
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

  /** Relative stamp for "Last synced". */
  const fmtSyncedAt = (ts: number): string => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return t('sync.justNow');
    if (diff < 3600_000) return t('sync.minAgo', { n: Math.floor(diff / 60_000) });
    const d = new Date(ts);
    const sameDay = new Date().toDateString() === d.toDateString();
    return sameDay
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (!syncState.initialized) {
    return (
      <div className="rounded-xl border border-line bg-ink/50 px-4 py-4">
        <h3 className="font-display text-[15px] font-bold text-cream">{t('sync.title')}</h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-sage">{t('sync.description')}</p>
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
            {t('sync.syncNow')}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="press btn-ghost h-10 rounded-xl px-4 text-sm font-semibold"
            >
              {t('sync.notNow')}
            </button>
          )}
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-faint">{t('sync.onlyNote')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-cream">
            {phase === 'syncing'
              ? t('sync.syncing')
              : lastError
                ? t('sync.failed')
                : t('sync.synced')}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-faint">
            {phase === 'syncing'
              ? t('sync.comparing')
              : lastError
                ? lastError
                : syncState.lastSuccessfulSyncAt
                  ? t('sync.lastSynced', { time: fmtSyncedAt(syncState.lastSuccessfulSyncAt) })
                  : t('sync.enabled')}
          </div>
        </div>
        <button
          onClick={() => void doSync(false)}
          disabled={phase === 'syncing'}
          className="press btn-ghost flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 font-mono text-[12px] disabled:opacity-50"
          aria-label={t('sync.syncNow')}
        >
          {phase === 'syncing' ? <Spinner /> : null}
          {t('sync.syncNow')}
        </button>
      </div>
    </div>
  );
}
