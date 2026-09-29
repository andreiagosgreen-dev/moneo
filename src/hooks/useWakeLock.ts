import { useEffect } from 'react';

interface Sentinel {
  release(): Promise<void>;
}
type WakeLockNav = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<Sentinel> };
};

/** Keep the screen on while `active`; silently does nothing where unsupported or denied. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const wl = (navigator as WakeLockNav).wakeLock;
    if (!active || !wl) return;
    let sentinel: Sentinel | null = null;
    let cancelled = false;

    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      wl.request('screen').then(
        (s) => {
          if (cancelled) void s.release().catch(() => {});
          else sentinel = s;
        },
        () => {},
      );
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (sentinel) void sentinel.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
