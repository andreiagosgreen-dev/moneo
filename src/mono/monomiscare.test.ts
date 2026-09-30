import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { createHabitObject, type Habit } from '../lib/habits';
import { setActiveRun } from '../lib/fitness/player';
import type { WorkoutStore } from '../lib/fitness/workouts';
import MonoMiscare from './MonoMiscare';

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
  setActiveRun(null);
  vi.useRealTimers();
});

const screen = (p: {
  store?: WorkoutStore;
  habits?: Habit[];
  onSave?: () => void;
  onDelete?: () => void;
}) =>
  createElement(MonoMiscare, {
    store: p.store ?? { log: [] },
    habits: p.habits ?? [],
    isPro: false,
    onSave: p.onSave ?? vi.fn(),
    onDelete: p.onDelete ?? vi.fn(),
  });

const button = (c: HTMLElement, text: string | RegExp) =>
  Array.from(c.querySelectorAll('button')).find((b) =>
    typeof text === 'string' ? b.textContent?.trim() === text : text.test(b.textContent ?? ''),
  );
const click = (el: Element | undefined) => {
  expect(el).toBeTruthy();
  act(() => {
    el!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('MonoMiscare', () => {
  it('lists routines and filters the exercise library by place', () => {
    const c = render(screen({}));
    expect(c.querySelectorAll('[data-testid^="fit-rt-"]').length).toBe(6);
    const rows = () => c.querySelectorAll('[data-testid="fit-library"] li').length;
    expect(rows()).toBe(10);
    click(button(c, 'Yoga'));
    expect(rows()).toBe(8);
    expect(button(c, 'Yoga')?.getAttribute('aria-pressed')).toBe('true');
    click(button(c, 'All'));
    expect(rows()).toBe(36);
    expect(c.textContent).toContain('No workouts yet this week.');
  });

  it('plays a routine: set done, rest, skip rest, finish, save with a new habit', () => {
    const onSave = vi.fn();
    const c = render(screen({ onSave }));
    click(c.querySelector('[aria-label="Start Home 20 min, no equipment"]') ?? undefined);
    const player = c.querySelector('[data-testid="fit-player"]')!;
    expect(player.textContent).toContain('Squat');
    expect(player.textContent).toContain('Exercise 1 of 7 · Set 1 of 3');

    click(button(c, 'Set done'));
    expect(c.querySelector('[data-testid="fit-rest"]')).toBeTruthy();
    click(button(c, 'Skip rest'));
    expect(c.textContent).toContain('Set 2 of 3');

    click(button(c, 'Finish'));
    const done = c.querySelector('[data-testid="fit-done"]')!;
    expect(done.textContent).toContain('Workout done');
    const select = done.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('new');

    click(button(c, 'Save workout'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const [entry, link] = onSave.mock.calls[0];
    expect(entry.routineId).toBe('home20');
    expect(entry.sets).toEqual([{ ex: 'squat', reps: 15 }]);
    expect(link).toEqual({ kind: 'create', name: 'Workout' });
    expect(c.querySelector('[role="status"]')?.textContent).toBe('Workout saved.');
  });

  it('suggests an existing workout habit', () => {
    const gym = createHabitObject('Gym', 'weekly', 3)!;
    const read = createHabitObject('Read', 'daily', 7)!;
    const onSave = vi.fn();
    const c = render(screen({ habits: [read, gym], onSave }));
    click(c.querySelector('[aria-label="Start Core in 10 min"]') ?? undefined);
    click(button(c, 'Set done'));
    click(button(c, 'Finish'));
    expect((c.querySelector('select') as HTMLSelectElement).value).toBe(gym.id);
    click(button(c, 'Save workout'));
    expect(onSave.mock.calls[0][1]).toEqual({ kind: 'habit', id: gym.id });
  });

  it('logs a timed hold when the timer runs out', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 30, 9, 0, 0));
    const c = render(screen({}));
    click(c.querySelector('[aria-label="Start Morning yoga 15 min"]') ?? undefined);
    expect(c.textContent).toContain('1:00');
    click(button(c, 'Start timer'));
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(c.querySelector('[data-testid="fit-rest"]')).toBeTruthy();
    click(button(c, 'Finish'));
    expect(c.querySelector('[data-testid="fit-done"]')?.textContent).toContain('Sets: 1');
  });

  it('keeps the workout in progress when the screen remounts', () => {
    const first = render(screen({}));
    click(first.querySelector('[aria-label="Start Home 20 min, no equipment"]') ?? undefined);
    click(button(first, 'Set done'));
    act(() => {
      root!.unmount();
    });
    container!.remove();
    const c = render(screen({}));
    expect(c.querySelector('[data-testid="fit-rest"]')).toBeTruthy();
    click(button(c, 'Quit'));
    click(Array.from(c.querySelectorAll('.mono-fit-confirm button'))[0]);
    expect(c.querySelector('[data-testid="fit-player"]')).toBeNull();
  });

  it('shows history with volume and deletes an entry', () => {
    const onDelete = vi.fn();
    const store: WorkoutStore = {
      log: [
        {
          id: 'w1',
          routineId: 'gymFull',
          day: '2026-9-29',
          startedAt: new Date(2026, 8, 29, 18).getTime(),
          durationSec: 2700,
          sets: [
            { ex: 'backSquat', reps: 8, kg: 60 },
            { ex: 'backSquat', reps: 8, kg: 60 },
          ],
        },
      ],
    };
    const c = render(screen({ store, onDelete }));
    const history = c.querySelector('[data-testid="fit-history"]')!;
    expect(history.textContent).toContain('Gym full body');
    expect(history.textContent).toContain('Volume: 960 kg');
    click(history.querySelector('button[aria-label^="Delete workout"]') ?? undefined);
    expect(onDelete).toHaveBeenCalledWith('w1');
  });
});
