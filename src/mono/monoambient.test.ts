import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoAmbientPicker from './MonoAmbientPicker';
import type { AmbientLayer } from '../lib/ambient';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(el: ReactElement): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(el);
  });
  return container;
}

afterEach(() => {
  if (root && container) {
    act(() => {
      root!.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
});

function Harness({
  initial,
  isPro,
  spy,
}: {
  initial: AmbientLayer[];
  isPro: boolean;
  spy: (l: AmbientLayer[]) => void;
}) {
  const [layers, setLayers] = useState(initial);
  return createElement(MonoAmbientPicker, {
    layers,
    isPro,
    wakeLock: true,
    onWakeLock: () => {},
    onChange: (l: AmbientLayer[]) => {
      spy(l);
      setLayers(l);
    },
  });
}

function picker(initial: AmbientLayer[], isPro: boolean, spy = vi.fn()) {
  return createElement(
    MemoryRouter,
    null,
    createElement(LocaleProvider, {
      locale: 'en',
      onLocaleChange: () => {},
      children: createElement(Harness, { initial, isPro, spy }),
    }),
  );
}

describe('MonoAmbientPicker', () => {
  it('Free: one sound at a time, Pro sounds locked, pricing link shown', () => {
    const spy = vi.fn();
    const c = render(picker([{ id: 'rain', volume: 0.6 }], false, spy));
    const radios = Array.from(c.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
    expect(radios).toHaveLength(5);
    expect(radios.filter((r) => r.disabled)).toHaveLength(2);
    expect(c.querySelectorAll('.mono-tag')).toHaveLength(2);
    expect(c.querySelector('a[href="/pricing"]')).not.toBeNull();
    act(() => radios[1].click());
    expect(spy).toHaveBeenLastCalledWith([{ id: 'ocean', volume: 0.6 }]);
    expect(c.querySelectorAll('input[type="range"]')).toHaveLength(1);
    expect(c.textContent).toContain('Keep screen on');
  });

  it('Pro: can add a third layer but not a fourth', () => {
    const spy = vi.fn();
    const c = render(picker([{ id: 'rain', volume: 0.6 }], true, spy));
    expect(c.querySelector('a[href="/pricing"]')).toBeNull();
    const boxes = () =>
      Array.from(c.querySelectorAll('.mono-amb-list input[type="checkbox"]')) as HTMLInputElement[];
    act(() => boxes()[1].click());
    act(() => boxes()[4].click());
    expect(spy).toHaveBeenLastCalledWith([
      { id: 'rain', volume: 0.6 },
      { id: 'ocean', volume: 0.6 },
      { id: 'brown', volume: 0.6 },
    ]);
    expect(boxes()[2].disabled).toBe(true);
    expect(boxes()[3].disabled).toBe(true);
    expect(c.querySelectorAll('input[type="range"]')).toHaveLength(3);
  });
});
