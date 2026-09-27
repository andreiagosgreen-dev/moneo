import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { DEFAULT_SETTINGS } from '../lib/store';
import { DEFAULT_THEME } from '../lib/theme';
import { FREE_ATMOSPHERES, PRO_ATMOSPHERES } from '../mono/atmosphere';
import SettingsCard from './SettingsCard';

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

function screen(
  overrides: {
    atmosphere?: string;
    onAtmosphere?: (a: string) => void;
    isPro?: boolean;
  } = {},
) {
  return createElement(
    MemoryRouter,
    null,
    createElement(LocaleProvider, {
      locale: 'en',
      onLocaleChange: () => {},
      children: createElement(SettingsCard, {
        settings: DEFAULT_SETTINGS,
        onChange: () => {},
        theme: DEFAULT_THEME,
        onThemeChange: () => {},
        isPro: overrides.isPro ?? false,
        atmosphere: (overrides.atmosphere ?? 'ritual') as 'ritual',
        onAtmosphere: overrides.onAtmosphere ?? (() => {}),
      }),
    }),
  );
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

describe('SettingsCard atmospheres', () => {
  const freeNames = [
    'Paper',
    'Sanctuary',
    'Clear',
    'Ritual',
    'Dawn',
    'Studio',
    'Chapter',
    'Shore',
    'Night',
    'Wax',
    'Snow',
    'Charcoal',
    'Garden',
    'Clay',
    'Ink',
    'Aurora',
    'Stone',
    'Honey',
    'Sea',
    'Lamp',
  ];

  const proNames = [
    'Coastal Light',
    'Sage Rouge',
    'Soft Horizon',
    'Cream Study',
    'Citron Sea',
    'Lilac White',
    'Cobalt Velvet',
    'Dive Orange',
    'Gallery Beige',
    'Lavender Cream',
    'Olive Ink',
    'Ember Night',
    'Burgundy Night',
    'Olive Grove',
    'Rose Noir',
    'Teal Blush',
    'Plum Olive',
    'Taupe Walnut',
    'Beige Burgundy',
    'Linen Ink',
    'Merlot Night',
    'Ivory Night',
  ];

  it('lists classic atmospheres free and Pro interiors locked for Free', () => {
    const onAtmosphere = vi.fn();
    const c = render(screen({ onAtmosphere, isPro: false }));
    expect(c.textContent).toContain('Atmosphere');
    expect(c.textContent).toContain('Classic palettes free · interior packs with Pro');
    expect(c.textContent).toContain('Upgrade to unlock Pro interiors');

    expect(freeNames.length).toBe(FREE_ATMOSPHERES.length);
    expect(proNames.length).toBe(PRO_ATMOSPHERES.length);
    for (const name of freeNames) {
      expect(c.textContent).toContain(name);
    }
    for (const name of proNames) {
      expect(c.textContent).toContain(name);
      expect(c.textContent).toContain(`${name} · Pro`);
    }

    const sanctuary = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'Sanctuary',
    )!;
    act(() => {
      sanctuary.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onAtmosphere).toHaveBeenCalledWith('sanctuar');

    onAtmosphere.mockClear();
    const coastal = Array.from(c.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Coastal Light'),
    )!;
    act(() => {
      coastal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onAtmosphere).not.toHaveBeenCalled();
  });

  it('lets Pro pick an interior pack without the lock label', () => {
    const onAtmosphere = vi.fn();
    const c = render(screen({ onAtmosphere, isPro: true }));
    expect(c.textContent).toContain('Classic and interior palettes for Focus');
    expect(c.textContent).not.toContain(' · Pro');

    const merlot = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'Merlot Night',
    )!;
    act(() => {
      merlot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onAtmosphere).toHaveBeenCalledWith('merlot');
  });
});
