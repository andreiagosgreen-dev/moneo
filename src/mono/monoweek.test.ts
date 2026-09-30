import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoWeek from './MonoWeek';
import MonoWeekRecap from './MonoWeekRecap';
import type { LastWeekRecap } from '../lib/weekRecap';

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

function wrap(child: ReactElement) {
  return createElement(LocaleProvider, { locale: 'en', onLocaleChange: () => {}, children: child });
}

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** Wednesday 2026-9-30, noon UTC. */
const NOW = Date.UTC(2026, 8, 30, 12);

type MoveFor = (dayKey: string) => { planned: string[]; done: boolean } | null;

function week(onOpenToday = vi.fn(), moveFor?: MoveFor) {
  return wrap(
    createElement(MonoWeek, {
      plans: [
        {
          dateKey: '2026-9-29',
          tasks: [{ id: 'a', text: 'Draft the report', done: true, rank: 1 }],
        },
      ],
      tasks: [],
      history: [{ at: Date.UTC(2026, 8, 29, 9), min: 50 }],
      habits: [],
      habitLog: {},
      timezone: 'UTC',
      onOpenToday,
      moveFor,
      now: NOW,
    }),
  );
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

describe('MonoWeek', () => {
  it('renders seven days with today highlighted', () => {
    const c = render(week());
    const days = c.querySelectorAll('[role="listitem"]');
    expect(days).toHaveLength(7);
    expect(days[2].classList.contains('is-today')).toBe(true);
    expect(c.querySelectorAll('.mono-week-day.is-future')).toHaveLength(4);
    expect(days[1].textContent).toContain('50m focus');
    expect(days[1].textContent).toContain('1/1 planned');
  });

  it('moves between weeks and offers a way back', () => {
    const c = render(week());
    const range = () => c.querySelector('.mono-week-range')!.textContent;
    const before = range();
    click(c.querySelector('[aria-label="Previous week"]')!);
    expect(range()).not.toBe(before);
    expect(c.querySelectorAll('.mono-week-day.is-today')).toHaveLength(0);
    const back = Array.from(c.querySelectorAll('.mono-chip')).find(
      (b) => b.textContent === 'This week',
    )!;
    click(back);
    expect(range()).toBe(before);
  });

  it('opens Today from today and shows details inline for another day', () => {
    const onOpenToday = vi.fn();
    const c = render(week(onOpenToday));
    const buttons = c.querySelectorAll('.mono-week-btn');
    click(buttons[2]);
    expect(onOpenToday).toHaveBeenCalledTimes(1);
    click(buttons[1]);
    const details = c.querySelector('.mono-week-details');
    expect(details?.textContent).toContain('Draft the report');
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('shows scheduled and finished workouts on their days', () => {
    const moveFor: MoveFor = (key) =>
      key === '2026-9-28'
        ? { planned: ['Home 20 min, no equipment'], done: true }
        : key === '2026-10-2'
          ? { planned: ['Morning yoga 15 min'], done: false }
          : null;
    const c = render(week(vi.fn(), moveFor));
    const days = c.querySelectorAll('[role="listitem"]');
    expect(days[0].querySelector('.mono-week-move')?.textContent).toBe('Workout done');
    expect(days[4].querySelector('.mono-week-move')?.textContent).toBe('Move: Morning yoga 15 min');
    expect(days[3].querySelector('.mono-week-move')).toBeNull();
    click(c.querySelectorAll('.mono-week-btn')[4]);
    expect(c.querySelector('.mono-week-details')?.textContent).toContain(
      'Move: Morning yoga 15 min',
    );
  });
});

describe('MonoWeekRecap', () => {
  const recap: LastWeekRecap = {
    start: '2026-9-28',
    end: '2026-10-4',
    focusMin: 95,
    sessions: 3,
    tasksDone: 4,
    habitCheckins: 6,
    xpGained: 155,
    newBadges: ['firstFocus'],
    bestDay: { key: '2026-10-2', min: 50 },
  };

  it('shows the numbers and new badges, and can be dismissed', () => {
    const onDismiss = vi.fn();
    const onOpenReports = vi.fn();
    const c = render(wrap(createElement(MonoWeekRecap, { recap, onDismiss, onOpenReports })));
    const text = c.textContent ?? '';
    expect(text).toContain('How last week went');
    expect(text).toContain('1h 35m');
    expect(text).toContain('+155');
    expect(text).toContain('First round');
    click(c.querySelector(`[aria-label="Hide last week's summary"]`)!);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    const open = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'See the report',
    )!;
    click(open);
    expect(onOpenReports).toHaveBeenCalledTimes(1);
  });
});
