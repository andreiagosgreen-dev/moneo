import { useEffect, useRef, useState } from 'react';
import { onWriteFailure } from '../lib/storage/storageAdapter';
import { requestPersistentStorage } from '../lib/storage/persistence';
import type { TKey, Vars } from '../lib/i18n/types';

export interface AppToast {
  message: string;
  action?: { label: string; onClick: () => void };
}

/**
 * The app-wide toast (auto-dismissed, longer when it carries an action) plus
 * the two local-data safeguards that report through it: a refused save is
 * announced at most once a minute with a shortcut to Settings, and once there
 * is work worth keeping the browser is asked not to evict storage.
 */
export function useAppToast({
  t,
  onOpenSettings,
  hasLocalWork,
}: {
  t: (key: TKey, vars?: Vars) => string;
  onOpenSettings: () => void;
  hasLocalWork: boolean;
}) {
  const [toast, setToast] = useState<AppToast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), toast.action ? 6000 : 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Latest callbacks without re-subscribing on every render.
  const tRef = useRef(t);
  const openRef = useRef(onOpenSettings);
  tRef.current = t;
  openRef.current = onOpenSettings;
  const lastSaveWarnRef = useRef(0);
  useEffect(
    () =>
      onWriteFailure(() => {
        const now = Date.now();
        if (now - lastSaveWarnRef.current < 60_000) return;
        lastSaveWarnRef.current = now;
        setToast({
          message: tRef.current('data.saveFailed'),
          action: {
            label: tRef.current('data.saveFailedAction'),
            onClick: () => openRef.current(),
          },
        });
      }),
    [],
  );

  useEffect(() => {
    if (hasLocalWork) void requestPersistentStorage();
  }, [hasLocalWork]);

  return { toast, setToast };
}
