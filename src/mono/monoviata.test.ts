import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoViata from './MonoViata';

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

describe('MonoViata', () => {
  it('shows motto, frames, next step and navigates', () => {
    const onGo = vi.fn();
    const c = render(
      createElement(LocaleProvider, {
        locale: 'en',
        onLocaleChange: () => {},
        children: createElement(MonoViata, {
          motto: { id: 't', text: 'Begin with the end in mind.', source: 'Stephen Covey' },
          frames: [
            { id: 'today', pct: 50, tab: 'today' },
            { id: 'focus', pct: 40, meta: 25, tab: 'focus' },
            { id: 'projects', pct: 10, tab: 'projects' },
            { id: 'life', pct: 70, tab: 'map' },
          ],
          next: { kind: 'workFocus', tab: 'focus' },
          onGo,
        }),
      }),
    );
    expect(c.textContent).toContain('Life');
    expect(c.textContent).toContain('Begin with the end in mind.');
    expect(c.textContent).toContain('Stephen Covey');
    expect(c.textContent).toContain('50%');
    expect(c.textContent).toContain('Work the top open item on Focus.');
    const cta = Array.from(c.querySelectorAll('button')).find((b) => b.textContent === 'Open Focus')!;
    act(() => {
      cta.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onGo).toHaveBeenCalledWith('focus');
  });
});
