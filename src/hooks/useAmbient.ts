import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  defaultAmbientFor,
  isSilent,
  sanitizeLayers,
  startAmbient,
  type AmbientHandle,
  type AmbientLayer,
} from '../lib/ambient';
import { getAudioContext } from '../lib/soundEngine';
import type { FocusPrefs } from '../lib/focusPrefs';
import type { Mode } from '../lib/store';

interface Options {
  running: boolean;
  phase: Mode;
  prefs: FocusPrefs;
  atmosphere: string;
  isPro: boolean;
}

/** Layers the user hears: saved mix (sanitised for the plan) or the atmosphere default. */
export function resolveLayers(
  prefs: FocusPrefs,
  atmosphere: string,
  isPro: boolean,
): AmbientLayer[] {
  const saved = prefs.ambient ? sanitizeLayers(prefs.ambient, isPro) : [];
  return saved.length > 0 ? saved : [{ id: defaultAmbientFor(atmosphere, isPro), volume: 0.6 }];
}

/** Ambient loop during a running focus phase only. `prime()` unlocks audio inside a click. */
export function useAmbient({ running, phase, prefs, atmosphere, isPro }: Options) {
  const layers = useMemo(() => resolveLayers(prefs, atmosphere, isPro), [prefs, atmosphere, isPro]);
  const handle = useRef<AmbientHandle | null>(null);
  const active = prefs.ambientOn && running && phase === 'focus' && !isSilent(layers);

  const prime = useCallback(() => {
    getAudioContext();
  }, []);

  useEffect(() => {
    if (!active) {
      const h = handle.current;
      handle.current = null;
      if (h) void h.stop();
      return;
    }
    if (handle.current) {
      handle.current.setLayers(layers);
      return;
    }
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      handle.current = startAmbient(ctx, layers);
    } catch {
      handle.current = null;
    }
  }, [active, layers]);

  useEffect(
    () => () => {
      const h = handle.current;
      handle.current = null;
      if (h) void h.stop(300);
    },
    [],
  );

  return { layers, playing: active, prime };
}
