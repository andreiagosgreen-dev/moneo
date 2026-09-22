import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import MonoBtn from './MonoBtn';
import MonoChip from './MonoChip';
import MonoTick from './MonoTick';
import MonoProgress from './MonoProgress';
import MonoToast from './MonoToast';

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

describe('Mono primitives', () => {
  it('MonoBtn renders variant classes + block', () => {
    const c = render(createElement(MonoBtn, { variant: 'ghost', block: true, children: 'Go' }));
    const btn = c.querySelector('button')!;
    expect(btn.className).toContain('mono-btn-ghost');
    expect(btn.className).toContain('mono-btn-block');
    expect(btn.textContent).toBe('Go');
  });

  it('MonoChip exposes aria-pressed', () => {
    const c = render(createElement(MonoChip, { pressed: true, children: '7 zile' }));
    expect(c.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('MonoTick toggles via click', () => {
    const onToggle = vi.fn();
    const c = render(createElement(MonoTick, { checked: false, onToggle, label: 'Done' }));
    const tick = c.querySelector('button')!;
    expect(tick.getAttribute('role')).toBe('checkbox');
    expect(tick.getAttribute('aria-checked')).toBe('false');
    act(() => {
      tick.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('MonoProgress clamps + exposes valuenow', () => {
    const c = render(createElement(MonoProgress, { value: 140, label: 'Zi' }));
    const bar = c.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });

  it('MonoToast shows only with a message', () => {
    const hidden = render(createElement(MonoToast, { message: null }));
    expect(hidden.querySelector('.mono-toast')!.className).not.toContain('show');
    if (root && container) {
      act(() => {
        root!.unmount();
      });
      container.remove();
    }
    root = null;
    container = null;
    const shown = render(createElement(MonoToast, { message: 'Salvat' }));
    expect(shown.querySelector('.mono-toast')!.className).toContain('show');
    expect(shown.textContent).toContain('Salvat');
  });
});
