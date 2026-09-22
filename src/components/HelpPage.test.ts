import { describe, expect, it, afterEach } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { ro } from '../lib/i18n/locales/ro';
import type { Locale } from '../lib/i18n/types';
import { MemoryRouter } from 'react-router-dom';
import HelpPage from './HelpPage';

// Enables React 18 act() flushing outside RTL.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderWithLocale(locale: Locale): string {
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
      children: createElement(HelpPage),
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
});

describe('HelpPage', () => {
  it('renders inside LocaleProvider without throwing (en)', () => {
    const text = renderWithLocale('en');
    expect(text).toContain('Help center');
    expect(text).toContain('Timer');
  });

  it('renders translated chrome (ro)', () => {
    const text = renderWithLocale('ro');
    expect(text).toContain('Centrul de ajutor');
    expect(text).toContain('Cronometru');
  });
});
