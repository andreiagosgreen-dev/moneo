import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { createHabitObject, type Habit } from '../lib/habits';
import { EXERCISES } from '../lib/fitness/library';
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

interface ScreenProps {
  store?: WorkoutStore;
  habits?: Habit[];
  isPro?: boolean;
  onSave?: () => void;
  onDelete?: () => void;
  onChange?: (next: WorkoutStore) => void;
}

/** Keeps the store in state, like App does, so place/schedule changes re-render. */
function Stateful(p: ScreenProps) {
  const [store, setStore] = useState<WorkoutStore>(p.store ?? { log: [] });
  return createElement(MonoMiscare, {
    store,
    habits: p.habits ?? [],
    isPro: p.isPro ?? false,
    onSave: p.onSave ?? vi.fn(),
    onDelete: p.onDelete ?? vi.fn(),
    onChange: (next: WorkoutStore) => {
      p.onChange?.(next);
      setStore(next);
    },
  });
}

const screen = (p: ScreenProps) => createElement(Stateful, p);

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
  it('filters routines and the library by the remembered place', () => {
    const onChange = vi.fn();
    const c = render(screen({ onChange }));
    const routines = () => c.querySelectorAll('[data-testid^="fit-rt-"]').length;
    const count = () => c.querySelector('[data-testid="fit-count"]')?.textContent;
    expect(routines()).toBe(11);
    expect(count()).toBe(`${EXERCISES.length} exercises`);
    expect(c.querySelectorAll('[data-testid="fit-library"] li').length).toBe(20);
    expect(c.textContent).toContain('No workouts yet this week.');
    expect(c.textContent).toContain('Goal: 3 workouts a week');

    click(button(c, 'Gym'));
    expect(onChange).toHaveBeenLastCalledWith({ log: [], place: 'gym' });
    expect(button(c, 'Gym')?.getAttribute('aria-pressed')).toBe('true');
    expect(c.querySelector('[data-testid="fit-rt-gymFull"]')).toBeTruthy();
    expect(c.querySelector('[data-testid="fit-rt-home20"]')).toBeNull();
    const gym = EXERCISES.filter((e) => e.places.includes('gym')).length;
    expect(count()).toBe(`${gym} exercises`);

    click(button(c, 'Anywhere'));
    expect(onChange).toHaveBeenLastCalledWith({ log: [] });
    expect(routines()).toBe(11);
  });

  it('combines type, muscle, equipment and search filters, then clears them', () => {
    const c = render(screen({}));
    const count = () => c.querySelector('[data-testid="fit-count"]')?.textContent;
    const rows = () =>
      Array.from(c.querySelectorAll('[data-testid="fit-library"] .mono-fit-name')).map(
        (n) => n.textContent,
      );

    click(button(c, 'Yoga'));
    expect(button(c, 'Yoga')?.getAttribute('aria-pressed')).toBe('true');
    const yoga = EXERCISES.filter((e) => e.type === 'yoga').length;
    expect(count()).toBe(`${yoga} exercises`);

    click(button(c, 'All types'));
    const [muscle, equipment] = Array.from(c.querySelectorAll('.mono-fit-selects select'));
    act(() => {
      (muscle as HTMLSelectElement).value = 'chest';
      muscle.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => {
      (equipment as HTMLSelectElement).value = 'barbell';
      equipment.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(rows()).toContain('Bench press');
    expect(rows()).not.toContain('Push-up');

    click(button(c, 'Clear filters'));
    expect(count()).toBe(`${EXERCISES.length} exercises`);

    const search = c.querySelector('input[type="search"]') as HTMLInputElement;
    act(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(search, 'PUSH-UP');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(rows()).toContain('Push-up');
    expect(rows().every((n) => /push-up/i.test(n ?? ''))).toBe(true);
  });

  it('pages the library and opens an exercise detail, then goes back', () => {
    const c = render(screen({}));
    click(button(c, /^Show more/));
    expect(c.querySelectorAll('[data-testid="fit-library"] li').length).toBe(40);

    click(c.querySelector('[aria-label="Open Push-up"]') ?? undefined);
    const detail = c.querySelector('[data-testid="fit-detail"]')!;
    expect(detail).toBeTruthy();
    expect(detail.querySelector('h2')?.textContent).toBe('Push-up');
    expect(detail.textContent).toContain('How to do it');
    expect(detail.textContent).toContain('Sagging hips. Squeeze glutes and abs.');
    expect(detail.textContent).toContain('Main');
    expect(detail.textContent).toContain('Chest');
    expect(detail.querySelector('.mono-fit-anim')).toBeTruthy();
    expect(detail.querySelector('[data-muscle="chest"]')?.getAttribute('data-lv')).toBe('3');

    const alt = detail.querySelector('button[aria-label^="Open "]') as HTMLButtonElement;
    const altName = alt.getAttribute('aria-label')!.slice(5);
    click(alt);
    expect(c.querySelector('[data-testid="fit-detail"] h2')?.textContent).toBe(altName);

    click(button(c, /Back to the library/));
    expect(c.querySelector('[data-testid="fit-detail"]')).toBeNull();
    expect(c.querySelector('[data-testid="fit-library"]')).toBeTruthy();
  });

  it('schedules a routine on weekdays and counts it in the weekly goal', () => {
    const onChange = vi.fn();
    const c = render(screen({ onChange }));
    click(c.querySelector('[aria-label="Schedule Home 20 min, no equipment"]') ?? undefined);
    const days = c.querySelector('[data-testid="fit-rt-home20"] .mono-fit-days')!;
    const chips = Array.from(days.querySelectorAll('button'));
    expect(chips).toHaveLength(7);
    click(chips[0]); // Monday
    click(chips[2]); // Wednesday
    expect(onChange).toHaveBeenLastCalledWith({
      log: [],
      plan: [{ routineId: 'home20', days: [1, 3] }],
    });
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
    expect(c.querySelector('[data-testid="fit-rt-home20"] .mono-fit-planned')?.textContent).toMatch(
      /^Scheduled: Mon, Wed$/,
    );
    expect(c.textContent).toContain('0 of 2 scheduled workouts done');
    click(chips[0]);
    expect(onChange).toHaveBeenLastCalledWith({
      log: [],
      plan: [{ routineId: 'home20', days: [3] }],
    });
  });

  it('heats worked muscles on the body map and filters the library on tap', () => {
    const store: WorkoutStore = {
      log: [
        {
          id: 'w1',
          routineId: 'home20',
          day: 'x',
          startedAt: Date.now() - 3_600_000,
          durationSec: 600,
          sets: [{ ex: 'pushup' }, { ex: 'pushup' }],
        },
      ],
    };
    const c = render(screen({ store }));
    const chest = c.querySelector('.mono-bmap [role="button"][data-muscle="chest"]')!;
    expect(chest.getAttribute('data-lv')).toBe('3');
    expect(chest.getAttribute('aria-label')).toBe('Chest: worked a lot');
    expect(
      c.querySelector('.mono-bmap [role="button"][data-muscle="calves"]')?.getAttribute('data-lv'),
    ).toBe('0');
    expect(button(c, /^30 days/)?.disabled).toBe(true);

    click(chest);
    expect(chest.getAttribute('aria-pressed')).toBe('true');
    const chestCount = EXERCISES.filter((e) => e.muscles.includes('chest')).length;
    expect(c.querySelector('[data-testid="fit-count"]')?.textContent).toBe(
      `${chestCount} exercises`,
    );
    click(chest);
    expect(c.querySelector('[data-testid="fit-count"]')?.textContent).toBe(
      `${EXERCISES.length} exercises`,
    );
  });

  it('shows an empty body map hint and unlocks 30 days with Pro', () => {
    const c = render(screen({ isPro: true }));
    expect(c.textContent).toContain('Finish a workout and the muscles you trained light up here.');
    const d30 = button(c, '30 days')!;
    expect(d30.disabled).toBe(false);
    click(d30);
    expect(d30.getAttribute('aria-pressed')).toBe('true');
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
