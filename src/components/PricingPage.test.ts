import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { ro } from '../lib/i18n/locales/ro';
import type { Locale } from '../lib/i18n/types';
import { DEFAULT_FREE_SUBSCRIPTION } from '../lib/cloud/subscriptionRepository';
import PricingPage from './PricingPage';

// Enables React 18 act() flushing outside RTL.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const authState = vi.hoisted(() => ({
  isPro: false,
  planId: 'free' as string,
  user: null as { userId: string } | null,
}));

vi.mock('../lib/authProvider', () => ({
  useAuth: () => ({
    isPro: authState.isPro,
    subscription: { ...DEFAULT_FREE_SUBSCRIPTION, planId: authState.planId },
    user: authState.user,
    status: authState.user ? 'authenticated' : 'anonymous',
    timezone: 'UTC',
    refreshSubscription: async () => {},
  }),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function LoginProbe() {
  const loc = useLocation();
  return createElement('p', null, `LOGIN${loc.search}`);
}

function renderPage(locale: Locale, url = '/pricing'): string {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const page = createElement(LocaleProvider, {
    locale,
    dictionary: locale === 'ro' ? ro : undefined,
    onLocaleChange: () => {},
    children: createElement(PricingPage),
  });
  const el: ReactElement = createElement(
    MemoryRouter,
    { initialEntries: [url] },
    createElement(
      Routes,
      null,
      createElement(Route, { path: '/pricing', element: page }),
      createElement(Route, { path: '/login', element: createElement(LoginProbe) }),
    ),
  );
  act(() => {
    root!.render(el);
  });
  return container.textContent ?? '';
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
  authState.isPro = false;
  authState.planId = 'free';
  authState.user = null;
});

describe('PricingPage (/pricing)', () => {
  it('renders prices from pricingConfig with a Free vs Pro table (en)', () => {
    const text = renderPage('en');
    const surface = container!.querySelector('.pricing-surface');
    const atmosphere = surface?.closest('.atm-root');
    expect(atmosphere).toBeTruthy();
    expect(atmosphere?.getAttribute('data-atmosphere')).toBeTruthy();
    expect(text).toContain('Moneo pricing');
    expect(text).toContain('$5.99');
    expect(text).toContain('$59.99');
    expect(text).toContain('$5.00');
    expect(text).toContain('2 months free');
    expect(text).toContain('Feature');
    expect(text).toContain('Unlimited');
    // Sync scope is honest: free = sessions, areas & settings; Pro = all data.
    expect(text).toContain('focus sessions, focus areas and settings sync between devices');
    expect(text).toContain('With Pro, all your data is saved to your account');
    expect(text).toContain('Sessions, areas & settings');
    expect(text).toContain('All your data');
    expect(text).toContain('Moneo works offline');
    expect(text).not.toMatch(/local-first/i);
  });

  it('renders translated chrome (ro)', () => {
    const text = renderPage('ro');
    expect(text).toContain('Prețuri Moneo');
    expect(text).toContain('Nelimitat');
    expect(text).toContain('Începe gratuit, fără card');
    expect(text).not.toMatch(/local-first/i);
  });

  it('shows the customer-portal entry for paid plans only', () => {
    expect(renderPage('en')).not.toContain('Manage subscription');
    authState.isPro = true;
    authState.planId = 'pro-monthly';
    authState.user = { userId: 'u-1' };
    expect(renderPage('en')).toContain('Manage subscription');
  });

  it('sends a logged-out buyer to sign-in with the chosen plan — no alert()', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderPage('en');
    const buttons = [...container!.querySelectorAll('button')].filter(
      (b) => b.textContent === 'Upgrade',
    );
    // Plan order: Free, Pro (Monthly), Pro (Yearly) → second button is yearly.
    expect(buttons).toHaveLength(2);
    act(() => {
      buttons[1].click();
    });
    expect(container!.textContent).toBe('LOGIN?upgrade=pro-yearly');
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('offers to continue checkout for the intended plan after sign-in', () => {
    authState.user = { userId: 'u-1' };
    const text = renderPage('en', '/pricing?upgrade=pro-yearly');
    expect(text).toContain('You’re signed in — finish your upgrade');
    expect(text).toContain('Continue to checkout');
  });

  it('ignores the intent for visitors and Pro users', () => {
    expect(renderPage('en', '/pricing?upgrade=pro-yearly')).not.toContain('Continue to checkout');
    authState.user = { userId: 'u-1' };
    authState.isPro = true;
    authState.planId = 'pro-monthly';
    expect(renderPage('en', '/pricing?upgrade=pro-yearly')).not.toContain('Continue to checkout');
  });
});
