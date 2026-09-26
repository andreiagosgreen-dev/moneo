import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoReturn from './MonoReturn';

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

describe('MonoReturn', () => {
  it('labels the origin and calls onBack', () => {
    const onBack = vi.fn();
    const c = render(
      createElement(LocaleProvider, {
        locale: 'en',
        onLocaleChange: () => {},
        children: createElement(MonoReturn, { to: 'map', onBack }),
      }),
    );
    expect(c.textContent).toContain('Back to Map');
    const btn = c.querySelector('button')!;
    act(() => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
