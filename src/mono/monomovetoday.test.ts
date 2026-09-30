import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { setRoutineDays, type WorkoutEntry, type WorkoutStore } from '../lib/fitness/workouts';
import MonoMoveToday from './MonoMoveToday';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(el: ReactElement): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(LocaleProvider, { locale: 'en', onLocaleChange: () => {}, children: el }),
    );
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

/** Wednesday 2026-9-30, 20:00 local. */
const NOW = new Date(2026, 8, 30, 20).getTime();
const TODAY = '2026-9-30';

const done = (routineId: string): WorkoutEntry => ({
  id: `w-${routineId}`,
  routineId,
  day: TODAY,
  startedAt: new Date(2026, 8, 30, 8).getTime(),
  durationSec: 1200,
  sets: [],
});

const card = (store: WorkoutStore, onStart = vi.fn(), onOpen = vi.fn()) =>
  render(createElement(MonoMoveToday, { store, dayKey: TODAY, now: NOW, onStart, onOpen }));

const click = (el: Element | null | undefined) => {
  expect(el).toBeTruthy();
  act(() => {
    el!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('MonoMoveToday', () => {
  it('offers to start what is scheduled today and tracks the weekly ring', () => {
    const onStart = vi.fn();
    const store = setRoutineDays({ log: [] }, 'home20', [1, 3, 5]);
    const c = card(store, onStart);
    const box = c.querySelector('[data-testid="move-today"]')!;
    expect(box.textContent).toContain('Today: Home 20 min, no equipment');
    expect(box.textContent).toContain('0 of 3 workouts this week');
    expect(c.querySelector('[aria-label="Workouts this week: 0 of 3"]')).toBeTruthy();
    click(c.querySelector('[aria-label="Start Home 20 min, no equipment"]'));
    expect(onStart).toHaveBeenCalledWith('home20');
  });

  it('celebrates a finished workout and hides the start button', () => {
    const store = setRoutineDays({ log: [done('home20')] }, 'home20', [3]);
    const c = card(store);
    expect(c.textContent).toContain('Done today: Home 20 min, no equipment');
    expect(c.querySelector('[aria-label^="Start "]')).toBeNull();
    expect(c.textContent).toContain('1 of 1 workouts this week');
  });

  it('says when nothing is scheduled and still opens Move', () => {
    const onOpen = vi.fn();
    const c = card({ log: [] }, vi.fn(), onOpen);
    expect(c.textContent).toContain('No workout scheduled today.');
    const open = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'Open Move',
    );
    click(open);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
