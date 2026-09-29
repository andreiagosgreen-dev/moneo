import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import type { Habit, HabitLog } from '../lib/habits';
import MonoHabitMonth from './MonoHabitMonth';
import MonoHabitsCheckin from './MonoHabitsCheckin';

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

const NOW = new Date(2026, 8, 26, 12, 0, 0).getTime(); // 2026-9-26 local
const CREATED = new Date(2026, 8, 1, 9, 0, 0).getTime();

const daily: Habit = {
  id: 'h1',
  name: 'Read 10 pages',
  frequency: 'daily',
  targetPerWeek: 7,
  createdAt: CREATED,
  updatedAt: CREATED,
};
const weekly: Habit = {
  id: 'h2',
  name: 'Weekly review',
  frequency: 'weekly',
  targetPerWeek: 1,
  createdAt: CREATED + 1,
  updatedAt: CREATED + 1,
};

function grid(habitLog: HabitLog = {}, onHabitLogChange: (log: HabitLog) => void = () => {}) {
  return createElement(LocaleProvider, {
    locale: 'en',
    onLocaleChange: () => {},
    children: createElement(MonoHabitMonth, {
      habits: [daily, weekly],
      habitLog,
      onHabitLogChange,
      now: NOW,
    }),
  });
}

function cells(c: HTMLElement): HTMLButtonElement[] {
  return Array.from(c.querySelectorAll<HTMLButtonElement>('[role="grid"] tbody button'));
}

function press(el: Element, key: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
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

describe('MonoHabitMonth', () => {
  it('renders one button per habit and day, with future days disabled', () => {
    const c = render(grid());
    const all = cells(c);
    expect(all).toHaveLength(2 * 30);
    expect(all.filter((b) => b.disabled)).toHaveLength(2 * 4);
    expect(c.querySelector('.mono-hgrid-title')?.textContent).toBe('September 2026');
    expect(c.querySelectorAll('[role="rowheader"], tbody th[scope="row"]').length).toBe(2);
  });

  it('reflects check-ins with aria-pressed and toggles through the callback', () => {
    const onChange = vi.fn();
    const c = render(grid({ h1: ['2026-9-25'] }, onChange));
    const row0 = cells(c).slice(0, 30);
    expect(row0[24].getAttribute('aria-pressed')).toBe('true');
    expect(row0[25].getAttribute('aria-pressed')).toBe('false');
    act(() => {
      row0[25].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as HabitLog).h1).toEqual(['2026-9-25', '2026-9-26']);
  });

  it('uses a roving tabindex starting on today and moves with the arrow keys', () => {
    const c = render(grid());
    const all = cells(c);
    const focusable = all.filter((b) => b.tabIndex === 0);
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toBe(all[25]);

    act(() => all[25].focus());
    press(all[25], 'ArrowRight'); // tomorrow is in the future: stay
    expect(document.activeElement).toBe(all[25]);
    press(all[25], 'ArrowLeft');
    expect(document.activeElement).toBe(all[24]);
    press(all[24], 'ArrowDown');
    expect(document.activeElement).toBe(all[30 + 24]);
    press(all[30 + 24], 'Home');
    expect(document.activeElement).toBe(all[30]);
    expect(cells(c).filter((b) => b.tabIndex === 0)).toEqual([all[30]]);
  });

  it('goes back a month and blocks going past the current one', () => {
    const c = render(grid());
    const [prev, next] = Array.from(c.querySelectorAll<HTMLButtonElement>('.mono-hgrid-nav'));
    expect(next.disabled).toBe(true);
    act(() => {
      prev.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(c.querySelector('.mono-hgrid-title')?.textContent).toBe('August 2026');
    expect(cells(c)).toHaveLength(2 * 31);
    expect(cells(c).some((b) => b.disabled)).toBe(false);
    expect(next.disabled).toBe(false);
  });

  it('summarises the month with a ring, week bars and top habits', () => {
    const log: HabitLog = { h1: ['2026-9-21', '2026-9-22', '2026-9-23'] };
    const c = render(grid(log));
    expect(c.textContent).toContain('Most consistent');
    expect(c.querySelector('.mono-pring')?.getAttribute('aria-label')).toMatch(/^Month: \d+%/);
    expect(c.querySelector('.mono-wbars')?.getAttribute('aria-label')).toContain('W1');
    expect(c.querySelectorAll('.mono-wbars-track')).toHaveLength(5);
  });
});

describe('MonoHabitsCheckin view switch', () => {
  it('switches between the Today list and the Month grid', () => {
    const c = render(
      createElement(LocaleProvider, {
        locale: 'en',
        onLocaleChange: () => {},
        children: createElement(MonoHabitsCheckin, {
          habits: [daily],
          habitLog: {},
          onHabitLogChange: () => {},
          now: NOW,
        }),
      }),
    );
    const chip = (name: string) =>
      Array.from(c.querySelectorAll<HTMLButtonElement>('.mono-chip')).find(
        (b) => b.textContent === name,
      )!;
    expect(chip('Today').getAttribute('aria-pressed')).toBe('true');
    expect(c.querySelector('[role="grid"]')).toBeNull();
    act(() => {
      chip('Month').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(chip('Month').getAttribute('aria-pressed')).toBe('true');
    expect(c.querySelector('[role="grid"]')).not.toBeNull();
  });

  it('hides the switch when there are no habits', () => {
    const c = render(
      createElement(LocaleProvider, {
        locale: 'en',
        onLocaleChange: () => {},
        children: createElement(MonoHabitsCheckin, {
          habits: [],
          habitLog: {},
          onHabitLogChange: () => {},
          now: NOW,
        }),
      }),
    );
    expect(c.querySelectorAll('.mono-chip')).toHaveLength(0);
  });
});
