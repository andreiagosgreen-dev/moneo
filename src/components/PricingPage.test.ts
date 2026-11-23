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
  status: 'free' as string,
  currentPeriodEnd: null as number | null,
  user: null as { userId: string } | null,
}));

const resolvePortal = vi.hoisted(() => vi.fn<() => Promise<string>>());
const subscriptionAction = vi.hoisted(() => vi.fn());
const refreshSubscription = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('../lib/billing/lemonSqueezy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/billing/lemonSqueezy')>()),
  resolveCustomerPortalUrl: resolvePortal,
  requestSubscriptionAction: subscriptionAction,
}));

vi.mock('../mono/MonoRankDiscount', () => ({
  default: () => null,
}));

vi.mock('../lib/authProvider', () => ({
  useAuth: () => ({
    isPro: authState.isPro,
    subscription: {
      ...DEFAULT_FREE_SUBSCRIPTION,
      planId: authState.planId,
      status: authState.status,
      currentPeriodEnd: authState.currentPeriodEnd,
      isPro: authState.isPro,
    },
    user: authState.user,
    status: authState.user ? 'authenticated' : 'anonymous',
    timezone: 'UTC',
    refreshSubscription,
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
  authState.status = 'free';
  authState.currentPeriodEnd = null;
  authState.user = null;
  resolvePortal.mockReset();
  subscriptionAction.mockReset();
  refreshSubscription.mockClear();
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

  it('manages and cancels a paid subscription inside Moneo', async () => {
    authState.isPro = true;
    authState.planId = 'pro-monthly';
    authState.status = 'active';
    authState.currentPeriodEnd = Date.UTC(2027, 0, 15);
    authState.user = { userId: 'u-1' };
    subscriptionAction.mockResolvedValue({
      ok: true,
      status: 'cancelled',
      endsAt: '2027-01-15T00:00:00.000Z',
    });
    const open = vi.spyOn(window, 'open').mockReturnValue({ opener: window } as Window);
    try {
      renderPage('en');
      const refund = [...container!.querySelectorAll('a')].find(
        (link) => link.textContent === 'Request a refund',
      );
      expect(refund?.getAttribute('href')).toBe('/refund');
      const manage = [...container!.querySelectorAll('button')].find(
        (button) => button.textContent === 'Manage or cancel',
      );
      expect(manage).toBeDefined();
      await act(async () => manage!.click());
      expect(document.body.textContent).toContain('Your subscription');
      expect(document.body.textContent).toContain('Cancel subscription');
      expect(open).not.toHaveBeenCalled();

      const cancel = [...document.body.querySelectorAll('button')].find(
        (button) => button.textContent === 'Cancel subscription',
      );
      act(() => cancel!.click());
      expect(document.body.textContent).toContain('Cancel future renewals?');
      const confirm = [...document.body.querySelectorAll('button')].find(
        (button) => button.textContent === 'Confirm cancellation',
      );
      await act(async () => confirm!.click());
      expect(subscriptionAction).toHaveBeenCalledWith('cancel');
      expect(document.body.textContent).toContain('Renewal stopped');
      expect(document.body.textContent).toContain('Resume subscription');
      expect(refreshSubscription).toHaveBeenCalledTimes(1);
    } finally {
      open.mockRestore();
    }
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
