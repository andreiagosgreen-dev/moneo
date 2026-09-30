import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { AuthProvider } from '../lib/authProvider';
import { DEFAULT_SETTINGS } from '../lib/store';
import { DEFAULT_THEME } from '../lib/theme';
import MonoSettings from './MonoSettings';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(el: ReactElement, onLocaleChange = vi.fn()): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(
        MemoryRouter,
        null,
        createElement(LocaleProvider, {
          locale: 'en',
          onLocaleChange,
          children: createElement(AuthProvider, { children: el }),
        }),
      ),
    );
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

const screen = (onChange = vi.fn()) =>
  createElement(MonoSettings, {
    settings: { ...DEFAULT_SETTINGS, focusMin: 30, shortMin: 5, dailyGoal: 6, sound: false },
    onChange,
    theme: DEFAULT_THEME,
    onThemeChange: () => {},
    isPro: false,
    atmosphere: 'ritual',
    onAtmosphere: () => {},
    synced: false,
    signedIn: false,
    user: null,
  });

describe('MonoSettings', () => {
  it('starts with every group collapsed and shows current values in the summaries', () => {
    const c = render(screen());
    const groups = Array.from(c.querySelectorAll('details.mono-set-group'));
    expect(groups.map((g) => g.getAttribute('data-testid'))).toEqual([
      'set-timer',
      'set-alerts',
      'set-look',
      'set-lang',
      'set-data',
      'set-plan',
      'set-help',
    ]);
    expect(groups.every((g) => !(g as HTMLDetailsElement).open)).toBe(true);
    const summary = (id: string) =>
      c.querySelector(`[data-testid="set-${id}"] summary`)?.textContent;
    expect(summary('timer')).toContain('Focus 30 min · Break 5 min · Daily goal: 6');
    expect(summary('alerts')).toContain('Chime off');
    expect(summary('look')).toContain('Ritual · Light');
    expect(summary('lang')).toContain('English');
    expect(summary('plan')).toContain('You are on Free');
    expect(c.textContent).toContain('Saved on this device');
  });

  it('keeps the controls working inside a group', () => {
    const onChange = vi.fn();
    const c = render(screen(onChange));
    const inc = c.querySelector('[data-testid="set-timer"] button[aria-label^="Increase"]');
    expect(inc).toBeTruthy();
    act(() => {
      inc!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({ focusMin: 31 });
  });

  it('switches language from native-name chips', () => {
    const onLocaleChange = vi.fn();
    const c = render(screen(), onLocaleChange);
    const ro = Array.from(c.querySelectorAll('[data-testid="set-lang"] button')).find(
      (b) => b.textContent === 'Română',
    );
    expect(
      c.querySelector('[data-testid="set-lang"] button[aria-pressed="true"]')?.textContent,
    ).toBe('English');
    act(() => {
      ro!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onLocaleChange).toHaveBeenCalledWith('ro');
  });
});
