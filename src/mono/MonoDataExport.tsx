import { useRef, useState, type ChangeEvent } from 'react';
import MonoCard from './MonoCard';
import MonoBtn from './MonoBtn';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import {
  applyImport,
  buildExport,
  downloadExport,
  parseExport,
  type CloudExport,
  type ImportError,
  type MoneoExport,
} from '../lib/dataExport';

interface Props {
  /** Signed-in identity; the export then also carries the synced cloud rows. */
  user?: { userId: string; email: string | null } | null;
  /** Injected for tests. */
  storage?: Storage;
  collectCloud?: (userId: string, email: string | null) => Promise<CloudExport>;
  onDownload?: (data: MoneoExport) => void;
  onImported?: () => void;
}

const IMPORT_ERROR_KEYS: Record<ImportError, TKey> = {
  'invalid-json': 'mono.export.err.invalidJson',
  'wrong-format': 'mono.export.err.wrongFormat',
  'unsupported-version': 'mono.export.err.unsupportedVersion',
  'invalid-shape': 'mono.export.err.invalidShape',
};

async function defaultCollectCloud(userId: string, email: string | null): Promise<CloudExport> {
  const { collectCloudExport } = await import('../lib/cloud/cloudExport');
  return collectCloudExport(userId, email);
}

/** Settings: free full-data export (JSON) and confirmed import that replaces local data. */
export default function MonoDataExport({
  user = null,
  storage,
  collectCloud = defaultCollectCloud,
  onDownload = (data) => downloadExport(data),
  onImported = () => window.location.reload(),
}: Props) {
  const { t, tag } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [includeAiKeys, setIncludeAiKeys] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState<MoneoExport | null>(null);

  const target = () => storage ?? window.localStorage;

  const doExport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const cloud = user ? await collectCloud(user.userId, user.email) : null;
      onDownload(buildExport(target(), { includeAiKeys, cloud }));
      setStatus({ kind: 'ok', text: t('mono.export.done') });
    } catch {
      setStatus({ kind: 'error', text: t('mono.export.failed') });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus(null);
    const parsed = parseExport(await file.text());
    if (!parsed.ok) {
      setStatus({ kind: 'error', text: t(IMPORT_ERROR_KEYS[parsed.error]) });
      return;
    }
    setPending(parsed.data);
  };

  const confirmImport = () => {
    if (!pending) return;
    try {
      applyImport(target(), pending);
    } catch {
      setPending(null);
      setStatus({ kind: 'error', text: t('mono.export.err.write') });
      return;
    }
    setPending(null);
    onImported();
  };

  const exportedDate = (() => {
    const d = pending ? new Date(pending.exportedAt) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(tag) : '—';
  })();

  return (
    <section aria-label={t('mono.export.title')}>
      <MonoCard>
        <p className="mono-eyebrow">{t('mono.export.title')}</p>
        <p className="mono-meta">{t('mono.export.body')}</p>
        {user ? (
          <p className="mono-meta" style={{ marginTop: 8 }}>
            {t('mono.export.cloudNote')}
          </p>
        ) : null}

        <label
          className="mono-meta"
          style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12 }}
        >
          <input
            type="checkbox"
            name="include-ai-keys"
            checked={includeAiKeys}
            onChange={(e) => setIncludeAiKeys(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            {t('mono.export.includeKeys')}
            <br />
            <span style={{ opacity: 0.8 }}>{t('mono.export.includeKeysHint')}</span>
          </span>
        </label>

        <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
          <MonoBtn variant="primary" block disabled={busy} onClick={() => void doExport()}>
            {busy ? t('mono.export.busy') : t('mono.export.download')}
          </MonoBtn>
          <MonoBtn
            variant="ghost"
            block
            disabled={busy || pending !== null}
            onClick={() => fileRef.current?.click()}
          >
            {t('mono.export.import')}
          </MonoBtn>
          <input
            ref={fileRef}
            type="file"
            name="moneo-import"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onFile(e)}
          />
        </div>

        {status ? (
          <p
            className="mono-meta"
            role={status.kind === 'error' ? 'alert' : 'status'}
            style={{ marginTop: 10 }}
          >
            {status.text}
          </p>
        ) : null}

        {pending ? (
          <div
            className="mono-danger-box"
            role="alertdialog"
            aria-labelledby="mono-import-confirm-title"
            aria-describedby="mono-import-confirm-body"
          >
            <p id="mono-import-confirm-title" className="mono-h3">
              {t('mono.export.confirmTitle')}
            </p>
            <p id="mono-import-confirm-body" className="mono-meta" style={{ marginTop: 4 }}>
              {t('mono.export.confirmBody', { date: exportedDate })}
            </p>
            <div className="mono-danger-actions">
              <MonoBtn variant="ghost" onClick={() => setPending(null)}>
                {t('mono.export.cancel')}
              </MonoBtn>
              <MonoBtn variant="primary" onClick={confirmImport}>
                {t('mono.export.confirm')}
              </MonoBtn>
            </div>
          </div>
        ) : null}
      </MonoCard>
    </section>
  );
}
