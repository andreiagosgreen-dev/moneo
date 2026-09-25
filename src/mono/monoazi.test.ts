import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoAzi from './MonoAzi';

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

function screen(overrides = {}) {
  return createElement(LocaleProvider, {
    locale: 'en',
    onLocaleChange: () => {},
    children: createElement(MonoAzi, {
      doneCount: 2,
      totalCount: 5,
      items: [
        { id: 'a', text: 'Curs, structuri de date', meta: '09:00 · 2h', done: true },
        { id: 'b', text: 'Schiță pentru capitolul 3', meta: '50 min', done: false },
      ],
      maxTasks: 6,
      morningLabel: 'Morning',
      shutdownLabel: 'Shutdown',
      onMorning: () => {},
      onShutdown: () => {},
      onToggle: () => {},
      onAdd: () => {},
      program: createElement('div', null, 'PROGRAM'),
      ...overrides,
    }),
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

describe('MonoAzi', () => {
  it('renders progress, priorities and program', () => {
    const c = render(screen());
    expect(c.textContent).toContain("Today's plan");
    expect(c.textContent).toContain('2 of 5 done');
    expect(c.textContent).toContain('40%');
    expect(c.textContent).toContain('Priorities');
    expect(c.textContent).toContain('Schiță pentru capitolul 3');
    expect(c.textContent).toContain('PROGRAM');
    expect(c.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('40');
  });

  it('toggles + adds tasks', () => {
    const onToggle = vi.fn();
    const onAdd = vi.fn();
    const c = render(screen({ onToggle, onAdd }));
    const ticks = c.querySelectorAll('[role="checkbox"]');
    expect(ticks.length).toBe(2);
    act(() => {
      ticks[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onToggle).toHaveBeenCalledWith('b');
    const input = c.querySelector('#mono-azi-new') as HTMLInputElement;
    expect(input).toBeTruthy();
  });

  it('disables the form when the list is full', () => {
    const c = render(screen({ totalCount: 6 }));
    const input = c.querySelector('#mono-azi-new') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe('List is full (6).');
  });

  it('shows an empty priorities card with plural add placeholder (no thick blank bar)', () => {
    const c = render(screen({ items: [], totalCount: 0, doneCount: 0 }));
    expect(c.textContent).toContain('Write below what you want to finish today');
    const input = c.querySelector('#mono-azi-new') as HTMLInputElement;
    expect(input.placeholder).toBe('Add tasks for today');
    expect(c.querySelectorAll('[role="checkbox"]').length).toBe(0);
  });

  it('fires ritual buttons', () => {
    const onMorning = vi.fn();
    const onShutdown = vi.fn();
    const c = render(screen({ onMorning, onShutdown }));
    const btns = Array.from(c.querySelectorAll('button')).filter((b) =>
      ['Morning', 'Shutdown'].includes(b.textContent ?? ''),
    );
    expect(btns.length).toBe(2);
    act(() => {
      btns[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onMorning).toHaveBeenCalledTimes(1);
  });
});
