import { describe, expect, it, afterEach } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { ro } from '../lib/i18n/locales/ro';
import MonoOrar from './MonoOrar';
import MonoProiecte from './MonoProiecte';
import MonoRapoarte from './MonoRapoarte';
import MonoCrestere from './MonoCrestere';

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

function withLocale(children: ReactElement): ReactElement {
  return createElement(LocaleProvider, {
    locale: 'ro',
    dictionary: ro,
    onLocaleChange: () => {},
    children,
  });
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

describe('Mono screen shells', () => {
  it('MonoOrar shows the Orar head + children', () => {
    const c = render(
      withLocale(createElement(MonoOrar, { timezone: 'Europe/Bucharest', children: 'CAL' })),
    );
    expect(c.textContent).toContain('Orar');
    expect(c.textContent).toContain('CAL');
  });

  it('MonoProiecte shows the active count + children', () => {
    const c = render(withLocale(createElement(MonoProiecte, { activeCount: 3, children: 'PROJ' })));
    expect(c.textContent).toContain('Proiecte');
    expect(c.textContent).toContain('3 proiecte active');
    expect(c.textContent).toContain('PROJ');
  });

  it('MonoRapoarte shows the Reports head + children', () => {
    const c = render(withLocale(createElement(MonoRapoarte, { children: 'REP' })));
    expect(c.textContent).toContain('Rapoarte');
    expect(c.textContent).toContain('REP');
  });

  it('MonoCrestere shows the Growth head + board children', () => {
    const c = render(withLocale(createElement(MonoCrestere, { children: 'GROW' })));
    expect(c.textContent).toContain('Creștere');
    expect(c.textContent).toContain('GROW');
    expect(c.querySelector('.mono-growth-board')).toBeTruthy();
  });
});
