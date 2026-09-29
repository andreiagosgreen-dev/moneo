import { describe, expect, it, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { ro } from '../lib/i18n/locales/ro';
import { isKnownClientRoute } from '../lib/knownRoutes';
import MonoNotFound from './MonoNotFound';

// Enables React 18 act() flushing outside RTL.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

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

describe('MonoNotFound', () => {
  it('shows the message and a link back to the app root', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        createElement(
          MemoryRouter,
          { initialEntries: ['/xyz-not-here'] },
          createElement(LocaleProvider, {
            locale: 'ro',
            dictionary: ro,
            onLocaleChange: () => {},
            children: createElement(MonoNotFound),
          }),
        ),
      );
    });
    expect(container.textContent).toContain(ro['mono.notFound.title']);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/');
    expect(link?.textContent).toBe('Înapoi la Moneo');
  });
});

describe('client catch-all route gate', () => {
  it('keeps app deep links and legal pages, rejects junk paths', () => {
    for (const path of [
      '/',
      '/welcome',
      '/account',
      '/account/calendar-callback',
      '/reset-password',
      '/terms',
      '/privacy',
      '/refund',
    ]) {
      expect(isKnownClientRoute(path)).toBe(true);
    }
    expect(isKnownClientRoute('/xyz-not-here')).toBe(false);
  });
});
