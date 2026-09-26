import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import type { Habit, HabitLog } from '../lib/habits';
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

const daily: Habit = {
  id: 'h1',
  name: 'Read 10 pages',
  frequency: 'daily',
  targetPerWeek: 7,
  createdAt: 1,
  updatedAt: 1,
};

const weekly: Habit = {
  id: 'h2',
  name: 'Weekly review',
  frequency: 'weekly',
  targetPerWeek: 1,
  createdAt: 2,
  updatedAt: 2,
};

/** Fixed morning so localDayKey is stable across TZ in CI. */
const NOW = new Date(2026, 8, 26, 12, 0, 0).getTime(); // 2026-9-26 local
const TODAY = '2026-9-26';

function screen(
  overrides: {
    habits?: Habit[];
    habitLog?: HabitLog;
    onHabitLogChange?: (log: HabitLog) => void;
    onManage?: () => void;
  } = {},
) {
  return createElement(LocaleProvider, {
    locale: 'en',
    onLocaleChange: () => {},
    children: createElement(MonoHabitsCheckin, {
      habits: overrides.habits ?? [daily, weekly],
      habitLog: overrides.habitLog ?? {},
      onHabitLogChange: overrides.onHabitLogChange ?? (() => {}),
      onManage: overrides.onManage,
      now: NOW,
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

describe('MonoHabitsCheckin', () => {
  it('renders active habits with Mono ticks', () => {
    const c = render(screen());
    expect(c.textContent).toContain('Habits');
    expect(c.textContent).toContain('0 of 2 today');
    expect(c.textContent).toContain('Read 10 pages');
    expect(c.textContent).toContain('Weekly review');
    expect(c.querySelectorAll('[role="checkbox"]').length).toBe(2);
  });

  it('toggles completion via the habit engine', () => {
    const onHabitLogChange = vi.fn();
    const c = render(screen({ onHabitLogChange }));
    const ticks = c.querySelectorAll('[role="checkbox"]');
    act(() => {
      ticks[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onHabitLogChange).toHaveBeenCalledTimes(1);
    const next = onHabitLogChange.mock.calls[0][0] as HabitLog;
    expect(next.h1).toContain(TODAY);
  });

  it('shows empty state and manage CTA', () => {
    const onManage = vi.fn();
    const c = render(screen({ habits: [], onManage }));
    expect(c.textContent).toContain('No habits yet');
    expect(c.querySelectorAll('[role="checkbox"]').length).toBe(0);
    const btn = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'Manage habits',
    )!;
    act(() => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onManage).toHaveBeenCalledTimes(1);
  });

  it('marks already-done habits and counts them', () => {
    const c = render(
      screen({
        habitLog: { h1: [TODAY] },
      }),
    );
    expect(c.textContent).toContain('1 of 2 today');
    const ticks = c.querySelectorAll('[role="checkbox"]');
    expect(ticks[0].getAttribute('aria-checked')).toBe('true');
    expect(ticks[1].getAttribute('aria-checked')).toBe('false');
  });
});
