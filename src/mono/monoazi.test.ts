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
      dayKey: '2026-9-26',
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
    expect(c.textContent).toContain('2 of 5 · 40%');
    expect(c.textContent).toContain('Priorities');
    expect(c.textContent).toContain('Schiță pentru capitolul 3');
    expect(c.textContent).toContain('PROGRAM');
    const ring = c.querySelector('.mono-pring')!;
    expect(ring.getAttribute('role')).toBe('img');
    expect(ring.getAttribute('aria-label')).toBe('Today: 2 of 5 done (40%)');
    expect(c.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('shows focus minutes today, or a gentle empty line', () => {
    expect(render(screen({ focusMinToday: 75 })).textContent).toContain('1h 15m of focus today');
    expect(render(screen()).textContent).toContain('No focus yet today');
  });

  it('hides the count line but keeps the ring for an empty plan', () => {
    const c = render(screen({ items: [], totalCount: 0, doneCount: 0 }));
    expect(c.textContent).not.toContain('NaN');
    expect(c.textContent).not.toContain('of 0');
    expect(c.querySelector('.mono-pring')).toBeTruthy();
    expect(c.textContent).toContain('0%');
  });

  it('shows priority and due pills for linked items only', () => {
    const c = render(
      screen({
        items: [
          {
            id: 'a',
            text: 'Linked late',
            meta: '',
            done: false,
            priority: 'p0',
            due: { kind: 'overdue', days: 1 },
          },
          {
            id: 'b',
            text: 'Normal soon',
            meta: '',
            done: false,
            priority: 'p2',
            due: { kind: 'future', days: 3 },
          },
          { id: 'c', text: 'Freeform', meta: '25m', done: false },
        ],
      }),
    );
    const pills = Array.from(c.querySelectorAll('.mono-pill')).map((x) => x.textContent);
    expect(pills).toEqual(['Urgent', '1 day overdue', 'In 3 days']);
    expect(c.querySelectorAll('.mono-pill-danger').length).toBe(2);
    expect(c.querySelectorAll('.mono-azi-pills').length).toBe(2);
  });

  it('dims pills of finished items', () => {
    const c = render(
      screen({
        items: [
          {
            id: 'a',
            text: 'Done late',
            meta: '',
            done: true,
            priority: 'p1',
            due: { kind: 'overdue', days: 2 },
          },
        ],
      }),
    );
    const pills = c.querySelectorAll('.mono-pill');
    expect(pills.length).toBe(2);
    pills.forEach((x) => expect(x.classList.contains('mono-pill-done')).toBe(true));
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

  it('keeps the field open when the list is full (overflow goes to the inbox)', () => {
    const c = render(screen({ totalCount: 6 }));
    const input = c.querySelector('#mono-azi-new') as HTMLInputElement;
    expect(input.disabled).toBe(false);
    expect(input.placeholder).toBe('List is full (6).');
  });

  it('previews recognised tokens and blocks a submit with no title', () => {
    const onAdd = vi.fn();
    const c = render(screen({ onAdd }));
    const input = c.querySelector('#mono-azi-new') as HTMLInputElement;
    const type = (value: string) =>
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    const submit = c.querySelector('button[type="submit"]') as HTMLButtonElement;

    type('Gym tomorrow 7:00 !1 30 min');
    const preview = c.querySelector('#mono-azi-qa')!;
    expect(preview.textContent).toContain('Urgent');
    expect(preview.textContent).toContain('30m');
    expect(submit.disabled).toBe(false);

    type('tomorrow 7:00');
    expect(submit.disabled).toBe(true);

    type('Call mom');
    expect(preview.textContent).toBe('');
  });

  it('keeps the draft when nothing was saved', () => {
    const onAdd = vi.fn(() => false);
    const c = render(screen({ onAdd }));
    const input = c.querySelector('#mono-azi-new') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'Read');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onAdd).toHaveBeenCalledWith('Read');
    expect(input.value).toBe('Read');
  });

  it('shows an empty priorities card with plural add placeholder (no thick blank bar)', () => {
    const c = render(screen({ items: [], totalCount: 0, doneCount: 0, program: undefined }));
    expect(c.textContent).toContain('What should you finish today?');
    expect(c.textContent).not.toContain('Draft the chapter outline');
    expect(c.textContent).toContain('Write the list. Work in order.');
    const input = c.querySelector('#mono-azi-new') as HTMLInputElement;
    expect(input.placeholder).toBe('Add tasks for today');
    expect(c.querySelectorAll('[role="checkbox"]').length).toBe(0);
    expect(c.textContent).not.toContain('Schedule');
  });

  it('shows go-work CTA when there are open priorities', () => {
    const onGoWork = vi.fn();
    const c = render(screen({ onGoWork }));
    expect(c.textContent).toContain('Open Focus');
    const btn = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'Open Focus',
    )!;
    act(() => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onGoWork).toHaveBeenCalledTimes(1);
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

  it('renders the habits slot between program and more', () => {
    const c = render(
      screen({
        habits: createElement('div', null, 'HABITS_SLOT'),
        more: createElement('div', null, 'MORE_SLOT'),
      }),
    );
    expect(c.textContent).toContain('HABITS_SLOT');
    expect(c.textContent).toContain('MORE_SLOT');
    const text = c.textContent ?? '';
    expect(text.indexOf('HABITS_SLOT')).toBeLessThan(text.indexOf('MORE_SLOT'));
  });
});
