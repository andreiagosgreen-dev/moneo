import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LocaleProvider } from '../../lib/i18n/LocaleContext';
import { de } from '../../lib/i18n/locales/de';
import { ro } from '../../lib/i18n/locales/ro';
import type { Dictionary, Locale } from '../../lib/i18n';
import { LEGAL_DOCS, LEGAL_PATHS, SUPPORT_MAILTO } from '../../lib/legal/seller';
import LegalPage from './LegalPage';

// Enables React 18 act() flushing outside RTL.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const DICTS: Partial<Record<Locale, Dictionary>> = { ro, de };

let root: Root | null = null;
let container: HTMLDivElement | null = null;

/** Same route table shape as App: one route per legal doc, the app on "*". */
function renderAt(url: string, locale: Locale = 'en'): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const wrap = (child: ReturnType<typeof createElement>) =>
    createElement(LocaleProvider, {
      locale,
      dictionary: DICTS[locale],
      onLocaleChange: () => {},
      children: child,
    });
  act(() => {
    root!.render(
      createElement(
        MemoryRouter,
        { initialEntries: [url] },
        createElement(
          Routes,
          null,
          ...LEGAL_DOCS.map((doc) =>
            createElement(Route, {
              key: doc,
              path: LEGAL_PATHS[doc],
              element: wrap(createElement(LegalPage, { doc })),
            }),
          ),
          createElement(Route, { path: '*', element: createElement('p', null, 'THE-APP') }),
        ),
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

describe('legal routes', () => {
  it('/refund renders the refund policy, not the app', () => {
    const el = renderAt('/refund');
    expect(el.querySelector('h1')?.textContent).toBe('Refund Policy');
    expect(el.textContent).not.toContain('THE-APP');
    expect(el.textContent).toContain('14 days');
    expect(el.querySelector('[role="note"]')).toBeNull();
  });

  it('links support by mailto and the other legal pages', () => {
    const el = renderAt('/terms');
    expect(el.querySelector('h1')?.textContent).toBe('Terms of Service');
    const mailto = el.querySelector('a[href^="mailto:"]');
    expect(mailto?.getAttribute('href')).toBe(SUPPORT_MAILTO);
    const hrefs = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/privacy', '/refund']));
  });

  it('Romanian gets the full translation and can switch to the English original', () => {
    const el = renderAt('/privacy', 'ro');
    expect(el.querySelector('h1')?.textContent).toBe('Politica de confidențialitate');
    expect(el.querySelector('[role="note"]')?.textContent).toContain(ro['legal.bindingNote']);
    expect(el.querySelector('article')?.getAttribute('lang')).toBe('ro');
    const btn = el.querySelector<HTMLButtonElement>('.mono-legal-switch');
    act(() => {
      btn!.click();
    });
    expect(el.querySelector('h1')?.textContent).toBe('Privacy Policy');
    expect(el.querySelector('article')?.getAttribute('lang')).toBe('en');
  });

  it('other locales read the English text under a localized binding note', () => {
    const el = renderAt('/terms', 'de');
    expect(el.querySelector('h1')?.textContent).toBe('Terms of Service');
    expect(el.querySelector('[role="note"]')?.textContent).toContain(de['legal.bindingNote']);
    expect(el.querySelector('.mono-legal-switch')).toBeNull();
  });

  it('unknown paths still fall through to the app', () => {
    expect(renderAt('/somewhere').textContent).toContain('THE-APP');
  });
});
