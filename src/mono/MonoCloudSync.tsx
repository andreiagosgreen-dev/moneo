import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MonoCard from './MonoCard';
import MonoBtn from './MonoBtn';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import { useProSyncStatus } from '../hooks/useProSync';
import { requestProSync } from '../lib/sync/proSyncController';
import type { ProSyncError } from '../lib/sync/proSyncEngine';
import { loadProSyncMeta } from '../lib/sync/proSyncState';
import { loadSyncState, onSyncStateChange } from '../lib/sync/syncState';

interface Props {
  isPro: boolean;
  /** Hide the "Open account" link when already on the account page. */
  onAccountPage?: boolean;
  /** Injected for tests. */
  onSyncNow?: (opts: { adoptAccount?: boolean }) => void;
}

const ERROR_KEYS: Record<ProSyncError, TKey> = {
  auth: 'mono.cloud.err.pull',
  consent: 'mono.cloud.offHint',
  pull: 'mono.cloud.err.pull',
  apply: 'mono.cloud.err.apply',
  push: 'mono.cloud.err.push',
  'not-migrated': 'mono.cloud.err.notMigrated',
  'not-pro': 'mono.cloud.err.notPro',
  'account-mismatch': 'mono.cloud.mismatchBody',
};

export type CloudSyncView = 'pro' | 'pro-off' | 'free' | 'lapsed';

/** Which explanation a signed-in user sees. Pure for tests. */
export function cloudSyncView(isPro: boolean, syncEnabled: boolean, usedProSync: boolean): CloudSyncView {
  if (isPro) return syncEnabled ? 'pro' : 'pro-off';
  return usedProSync ? 'lapsed' : 'free';
}

/** Account sync status: what is saved to the account, when, and what to do on errors. */
export default function MonoCloudSync({
  isPro,
  onAccountPage = false,
  onSyncNow = (opts) => void requestProSync(opts),
}: Props) {
  const { t, tag } = useI18n();
  const status = useProSyncStatus();
  const [syncEnabled, setSyncEnabled] = useState(() => loadSyncState().initialized);
  useEffect(() => onSyncStateChange(() => setSyncEnabled(loadSyncState().initialized)), []);
  const usedProSync = useMemo(() => loadProSyncMeta().lastSuccessAt !== null, []);
  const view = cloudSyncView(isPro, syncEnabled, usedProSync);

  const fmtTime = (ts: number): string => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return t('sync.justNow');
    if (diff < 3_600_000) return t('sync.minAgo', { n: Math.floor(diff / 60_000) });
    const d = new Date(ts);
    return new Date().toDateString() === d.toDateString()
      ? d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(tag, { month: 'short', day: 'numeric' });
  };

  const accountLink = onAccountPage ? null : (
    <Link to="/account" className="mono-link">
      {t('mono.cloud.openAccount')}
    </Link>
  );

  return (
    <section aria-label={t('mono.cloud.title')} data-testid="mono-cloud-sync" data-view={view}>
      <MonoCard>
        <p className="mono-eyebrow">{t('mono.cloud.title')}</p>

        {view === 'pro' ? (
          <>
            <p className="mono-h3">{t('mono.cloud.proLead')}</p>
            <p className="mono-meta" style={{ marginTop: 4 }}>
              {t('mono.cloud.proBody')}
            </p>
            {status.error === 'account-mismatch' ? (
              <div className="mono-danger-box" role="alert">
                <p className="mono-h3">{t('mono.cloud.mismatchTitle')}</p>
                <p className="mono-meta" style={{ marginTop: 4 }}>
                  {t('mono.cloud.mismatchBody')}
                </p>
                <div className="mono-danger-actions">
                  <MonoBtn variant="primary" onClick={() => onSyncNow({ adoptAccount: true })}>
                    {t('mono.cloud.mismatchCta')}
                  </MonoBtn>
                </div>
              </div>
            ) : (
              <>
                <p
                  className="mono-meta"
                  role={status.error ? 'alert' : 'status'}
                  style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      flex: 'none',
                      background: status.error
                        ? 'var(--mono-danger)'
                        : status.phase === 'syncing'
                          ? 'var(--mono-accent)'
                          : 'var(--mono-success)',
                    }}
                  />
                  <span>
                    <strong>
                      {status.phase === 'syncing'
                        ? t('mono.cloud.syncing')
                        : status.error
                          ? t('mono.cloud.notSynced')
                          : status.lastSuccessAt
                            ? t('mono.cloud.synced')
                            : t('mono.cloud.never')}
                    </strong>
                    {status.phase !== 'syncing' && status.lastSuccessAt ? (
                      <> · {t('mono.cloud.lastSync', { time: fmtTime(status.lastSuccessAt) })}</>
                    ) : null}
                  </span>
                </p>
                {status.error && status.phase !== 'syncing' ? (
                  <p className="mono-meta" style={{ marginTop: 4 }}>
                    {t(ERROR_KEYS[status.error])}
                  </p>
                ) : null}
                <div style={{ marginTop: 14 }}>
                  <MonoBtn
                    variant="ghost"
                    block
                    disabled={status.phase === 'syncing'}
                    onClick={() => onSyncNow({})}
                  >
                    {t('mono.cloud.syncNow')}
                  </MonoBtn>
                </div>
              </>
            )}
          </>
        ) : null}

        {view === 'pro-off' ? (
          <>
            <p className="mono-h3">{t('mono.cloud.proLead')}</p>
            <p className="mono-meta" style={{ marginTop: 4 }}>
              {t('mono.cloud.offHint')} {accountLink}
            </p>
          </>
        ) : null}

        {view === 'free' ? (
          <>
            <p className="mono-meta">{t('mono.cloud.freeBody')}</p>
            <p className="mono-meta" style={{ marginTop: 8 }}>
              {t('mono.cloud.freeUpsell')}{' '}
              <Link to="/pricing" className="mono-link">
                {t('mono.cloud.seePro')}
              </Link>
            </p>
          </>
        ) : null}

        {view === 'lapsed' ? (
          <>
            <p className="mono-h3">{t('mono.cloud.lapsedTitle')}</p>
            <p className="mono-meta" style={{ marginTop: 4 }}>
              {t('mono.cloud.lapsedBody')}
            </p>
            <p className="mono-meta" style={{ marginTop: 8 }}>
              <Link to="/pricing" className="mono-link">
                {t('mono.cloud.renew')}
              </Link>
            </p>
          </>
        ) : null}
      </MonoCard>
    </section>
  );
}
