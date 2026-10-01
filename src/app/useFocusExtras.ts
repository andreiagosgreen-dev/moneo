import { useEffect, useRef, useState } from 'react';
import { loadFocusPrefs, saveFocusPrefs, type FocusPrefs } from '../lib/focusPrefs';
import { useAmbient } from '../hooks/useAmbient';
import { useWakeLock } from '../hooks/useWakeLock';
import { useFullscreen } from '../hooks/useFullscreen';
import type { Mode } from '../lib/store';
import type { Atmosphere } from '../mono/atmosphere';

/**
 * Focus extras around the timer: saved preferences, ambient sound, screen wake
 * lock and full-screen "zen" (left automatically when leaving the Focus tab).
 */
export function useFocusExtras({
  running,
  mode,
  atmosphere,
  isPro,
  onFocusTab,
  toggle,
}: {
  running: boolean;
  mode: Mode;
  atmosphere: Atmosphere;
  isPro: boolean;
  onFocusTab: boolean;
  toggle: () => void;
}) {
  const [focusPrefs, setFocusPrefs] = useState<FocusPrefs>(loadFocusPrefs);
  const updateFocusPrefs = (patch: Partial<FocusPrefs>) =>
    setFocusPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveFocusPrefs(next);
      return next;
    });
  const ambient = useAmbient({ running, phase: mode, prefs: focusPrefs, atmosphere, isPro });
  useWakeLock(focusPrefs.wakeLock && running);
  const focusRootRef = useRef<HTMLDivElement>(null);
  const zen = useFullscreen(focusRootRef);
  const zenActive = zen.active;
  const zenToggle = zen.toggle;
  useEffect(() => {
    if (!onFocusTab && zenActive) zenToggle();
  }, [onFocusTab, zenActive, zenToggle]);
  // Starting a round is a user gesture: unlock audio before the timer runs.
  const handleFocusToggle = () => {
    if (focusPrefs.ambientOn && !running) ambient.prime();
    toggle();
  };
  return { focusPrefs, updateFocusPrefs, ambient, focusRootRef, zen, handleFocusToggle };
}
