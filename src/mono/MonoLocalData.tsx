import { useState } from 'react';
import { Link } from 'react-router-dom';
import MonoCard from './MonoCard';
import MonoBtn from './MonoBtn';
import { useI18n } from '../lib/i18n/LocaleContext';
import { clearAllLocalData } from '../lib/localDataReset';

interface Props {
  /** Signed-in users also get a pointer to the account deletion flow. */
  signedIn?: boolean;
  /** Injected for tests; defaults to a full page reload. */
  onCleared?: () => void;
}

/** Settings: wipe every Moneo item stored in this browser (confirmed). */
export default function MonoLocalData({ signedIn = false, onCleared }: Props) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const wipe = async () => {
    setBusy(true);
    await clearAllLocalData();
    if (onCleared) onCleared();
    else window.location.reload();
  };

  return (
    <section aria-label={t('mono.data.title')}>
      <MonoCard>
        <p className="mono-eyebrow">{t('mono.data.title')}</p>
        <p className="mono-meta">{t('mono.data.body')}</p>
        {signedIn ? (
          <p className="mono-meta" style={{ marginTop: 8 }}>
            {t('mono.data.accountNote')}{' '}
            <Link to="/account" className="mono-link">
              {t('mono.data.accountLink')}
            </Link>
          </p>
        ) : (
          <p className="mono-meta" style={{ marginTop: 8 }}>
            {t('mono.data.guestNote')}{' '}
            <Link to="/login" className="mono-link">
              {t('mono.data.guestLink')}
            </Link>
          </p>
        )}

        {!confirming ? (
          <div style={{ marginTop: 14 }}>
            <MonoBtn variant="ghost" block onClick={() => setConfirming(true)}>
              {t('mono.data.wipe')}
            </MonoBtn>
          </div>
        ) : (
          <div
            className="mono-danger-box"
            role="alertdialog"
            aria-labelledby="mono-data-confirm-title"
            aria-describedby="mono-data-confirm-body"
          >
            <p id="mono-data-confirm-title" className="mono-h3">
              {t('mono.data.confirmTitle')}
            </p>
            <p id="mono-data-confirm-body" className="mono-meta" style={{ marginTop: 4 }}>
              {t('mono.data.confirmBody')}
            </p>
            <div className="mono-danger-actions">
              <MonoBtn variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                {t('mono.data.cancel')}
              </MonoBtn>
              <MonoBtn variant="primary" disabled={busy} onClick={() => void wipe()}>
                {t('mono.data.confirm')}
              </MonoBtn>
            </div>
          </div>
        )}
      </MonoCard>
    </section>
  );
}
