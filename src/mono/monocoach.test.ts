import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoCoach from './MonoCoach';

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
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

describe('MonoCoach', () => {
  it('shows question, hint, examples and fires onExample', () => {
    const onExample = vi.fn();
    const c = render(
      createElement(LocaleProvider, {
        locale: 'en',
        onLocaleChange: () => {},
        children: createElement(MonoCoach, {
          kind: 'aziEmpty',
          dayKey: '2026-9-26',
          onExample,
        }),
      }),
    );
    expect(c.textContent).toContain('Guide');
    expect(c.textContent).toContain('What should you finish today?');
    expect(c.textContent).toContain('Draft the chapter outline');
    const chip = Array.from(c.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Draft the chapter outline'),
    )!;
    act(() => {
      chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onExample).toHaveBeenCalledWith('Draft the chapter outline');
  });

  it('dismisses and can show again', () => {
    const c = render(
      createElement(LocaleProvider, {
        locale: 'en',
        onLocaleChange: () => {},
        children: createElement(MonoCoach, {
          kind: 'aziOpen',
          dayKey: '2026-9-26',
        }),
      }),
    );
    const dismiss = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'Dismiss',
    )!;
    act(() => {
      dismiss.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(c.textContent).not.toContain('Start with the top open item?');
    expect(c.textContent).toContain('Show guide');
    expect(localStorage.getItem('moneo.coach.dismissed.2026-9-26.aziOpen')).toBe('1');
    const show = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'Show guide',
    )!;
    act(() => {
      show.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(c.textContent).toContain('Start with the first open item?');
    expect(localStorage.getItem('moneo.coach.dismissed.2026-9-26.aziOpen')).toBeNull();
  });
});
