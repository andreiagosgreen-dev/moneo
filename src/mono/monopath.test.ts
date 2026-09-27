import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoPath from './MonoPath';

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

describe('MonoPath', () => {
  it('highlights the active step and navigates on click', () => {
    const onGo = vi.fn();
    const c = render(
      createElement(LocaleProvider, {
        locale: 'en',
        onLocaleChange: () => {},
        children: createElement(MonoPath, { active: 'focus', onGo }),
      }),
    );
    expect(c.textContent).toContain('Write');
    expect(c.textContent).toContain('Work');
    expect(c.textContent).toContain('When');
    expect(c.textContent).not.toContain('Life');
    const on = c.querySelector('.mono-path-step.is-on');
    expect(on?.textContent).toContain('Work');
    const write = Array.from(c.querySelectorAll('.mono-path-step')).find((b) =>
      b.textContent?.includes('Write'),
    )!;
    act(() => {
      write.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onGo).toHaveBeenCalledWith('today');
  });

  it('adds Life as step 4 when withLife is set', () => {
    const onGo = vi.fn();
    const c = render(
      createElement(LocaleProvider, {
        locale: 'en',
        onLocaleChange: () => {},
        children: createElement(MonoPath, { active: 'map', onGo, withLife: true }),
      }),
    );
    expect(c.textContent).toContain('Life');
    const life = Array.from(c.querySelectorAll('.mono-path-step')).find((b) =>
      b.textContent?.includes('Life'),
    )!;
    expect(life.className).toContain('is-on');
    act(() => {
      life.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onGo).toHaveBeenCalledWith('map');
  });
});
