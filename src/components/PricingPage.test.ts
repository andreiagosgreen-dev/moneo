import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
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

function renderPage(locale: Locale): string {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const el: ReactElement = createElement(
    MemoryRouter,
    null,
    createElement(LocaleProvider, {
      locale,
      dictionary: locale === 'ro' ? ro : undefined,
      onLocaleChange: () => {},
      children: createElement(PricingPage),
    }),
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
    expect(text).toContain('Moneo pricing');
    expect(text).toContain('$5.99');
    expect(text).toContain('$59.99');
    expect(text).toContain('$5.00');
    expect(text).toContain('2 months free');
    expect(text).toContain('Feature');
    expect(text).toContain('Unlimited');
    // Sync scope is honest: sessions, areas & settings only.
    expect(text).toContain('focus sessions, focus areas and settings only');
    expect(text).toContain('Everything works offline');
  });

  it('renders translated chrome (ro)', () => {
    const text = renderPage('ro');
    expect(text).toContain('Prețuri Moneo');
    expect(text).toContain('Nelimitat');
  });

  it('shows the customer-portal entry for paid plans only', () => {
    expect(renderPage('en')).not.toContain('Manage subscription');
    authState.isPro = true;
    authState.planId = 'pro-monthly';
    authState.user = { userId: 'u-1' };
    expect(renderPage('en')).toContain('Manage subscription');
  });
});
