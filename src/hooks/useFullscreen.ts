import { useCallback, useEffect, useState, type RefObject } from 'react';

const ZEN = 'mono-zen';

/** Fullscreen on `ref` when the browser allows it, else CSS zen; `.mono-zen` on <html> mirrors state. */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled === true;

  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(ZEN, active);
    if (!active || document.fullscreenElement) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  useEffect(
    () => () => {
      document.documentElement.classList.remove(ZEN);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    },
    [],
  );

  const toggle = useCallback(() => {
    if (active) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      setActive(false);
      return;
    }
    const el = ref.current;
    if (supported && el) {
      el.requestFullscreen().then(
        () => setActive(true),
        () => setActive(true),
      );
    } else setActive(true);
  }, [active, ref, supported]);

  return { active, supported, toggle };
}
