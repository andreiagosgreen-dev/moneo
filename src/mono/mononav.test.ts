import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { AuthProvider } from '../lib/authProvider';
import MonoNav, { type MonoTab } from './MonoNav';
import MonoMore from './MonoMore';

// Enables React 18 act() flushing outside RTL.
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

function withProviders(tab: MonoTab, onTab: (t: MonoTab) => void): ReactElement {
  return createElement(
    MemoryRouter,
    null,
    createElement(LocaleProvider, {
      locale: 'en',
      onLocaleChange: () => {},
      children: createElement(MonoNav, { tab, onTab, onNewSession: () => onTab('focus') }),
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

describe('MonoNav', () => {
  it('renders primary modules + settings with the active one selected', () => {
    const c = render(withProviders('today', () => {}));
    const tabs = c.querySelectorAll('[role="tab"]');
    // focus,today,orar,projects,reports,plan,growth,map,more,settings
    expect(tabs.length).toBeGreaterThanOrEqual(9);
    const selected = Array.from(tabs).filter((el) => el.getAttribute('aria-selected') === 'true');
    expect(selected.length).toBe(1);
    expect(selected[0].textContent).toContain('Today');
  });

  it('selects Plan directly in the rail (not via More)', () => {
    const c = render(withProviders('plan', () => {}));
    const tabs = Array.from(c.querySelectorAll('[role="tab"]'));
    const selected = tabs.filter((el) => el.getAttribute('aria-selected') === 'true');
    expect(selected.length).toBe(1);
    expect(selected[0].textContent).toMatch(/Plan|Goals/i);
  });

  it('shows the brand mark beside the Moneo name', () => {
    const c = render(withProviders('focus', () => {}));
    const brand = c.querySelector('.mono-rail-brand');
    expect(brand).toBeTruthy();
    const img = brand!.querySelector('img.mono-rail-mark') as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toBe('/brand/moneo-mark-1200.png');
    expect(brand!.textContent).toContain('Moneo');
  });
});

describe('MonoMore', () => {
  it('opens secondary destinations', () => {
    const onOpen = vi.fn();
    const c = render(
      createElement(
        MemoryRouter,
        null,
        createElement(LocaleProvider, {
          locale: 'en',
          onLocaleChange: () => {},
          children: createElement(AuthProvider, {
            children: createElement(MonoMore, { tab: 'more', onOpen }),
          }),
        }),
      ),
    );
    expect(c.textContent).toMatch(/Planning modules|left rail|More/i);
    const plan = Array.from(c.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('Goals'),
    )!;
    act(() => {
      plan.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onOpen).toHaveBeenCalledWith('plan');
  });
});
