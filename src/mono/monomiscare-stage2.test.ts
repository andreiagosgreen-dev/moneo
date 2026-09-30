import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { exerciseStep } from '../lib/fitness/library';
import { newCustomRoutine, upsertCustom, type CustomRoutine } from '../lib/fitness/custom';
import { setActiveRun } from '../lib/fitness/player';
import type { WorkoutEntry, WorkoutStore } from '../lib/fitness/workouts';
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
});

interface ScreenProps {
  store?: WorkoutStore;
  isPro?: boolean;
  onSave?: (entry: WorkoutEntry, routine?: CustomRoutine) => void;
  onChange?: (next: WorkoutStore) => void;
}

/** Keeps the store in state like App: saves append to the log, edits replace it. */
function Stateful(p: ScreenProps) {
  const [store, setStore] = useState<WorkoutStore>(p.store ?? { log: [] });
  return createElement(MonoMiscare, {
    store,
    habits: [],
    isPro: p.isPro ?? false,
    onSave: (entry: WorkoutEntry, _link: unknown, routine?: CustomRoutine) => {
      p.onSave?.(entry, routine);
      setStore((s) => {
        const logged = { ...s, log: [...s.log, entry] };
        return routine ? upsertCustom(logged, routine) : logged;
      });
    },
    onDelete: vi.fn(),
    onChange: (next: WorkoutStore) => {
      p.onChange?.(next);
      setStore(next);
    },
  });
}

const screen = (p: ScreenProps) => createElement(Stateful, p);

const button = (c: HTMLElement, text: string | RegExp) =>
  Array.from(c.querySelectorAll('button')).find((b) =>
    typeof text === 'string'
      ? b.textContent?.trim() === text || b.getAttribute('aria-label') === text
      : text.test(b.textContent ?? '') || text.test(b.getAttribute('aria-label') ?? ''),
  );
const click = (el: Element | null | undefined) => {
  expect(el).toBeTruthy();
  act(() => {
    el!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
const type = (el: Element | null, value: string) => {
  expect(el).toBeTruthy();
  act(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(el, value);
    el!.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

/** Searches the exercise picker, then adds the exercise. */
function pick(c: HTMLElement, name: string) {
  type(c.querySelector('.mono-fit-picker input[type="search"]'), name);
  click(button(c, `Add ${name}`));
}

/** Logs every set of the current exercise, skipping rests. */
function doAllSets(c: HTMLElement) {
  for (let i = 0; i < 10 && button(c, 'Set done'); i++) {
    click(button(c, 'Set done'));
    const skip = button(c, 'Skip rest');
    if (skip) click(skip);
  }
}

const T0 = 1_800_000_000_000;
const DAY = 86_400_000;
const logged = (id: string, at: number, sets: WorkoutEntry['sets']): WorkoutEntry => ({
  id,
  routineId: 'home20',
  day: '2027-1-1',
  startedAt: at,
  durationSec: 600,
  sets,
});

describe('MonoMiscare — free workout', () => {
  it('picks exercises as you go and saves the workout (Free)', () => {
    const onSave = vi.fn();
    const c = render(screen({ onSave }));
    click(button(c, 'Start Free workout'));
    expect(c.textContent).toContain('Pick your first exercise');
    expect(c.querySelector('[data-testid="fit-picker"]')).toBeTruthy();

    pick(c, 'Push-up');
    expect(c.querySelector('#fit-player-title')?.textContent).toBe('Free workout');
    expect(c.querySelector('.mono-fit-stage h3')?.textContent).toBe('Push-up');
    doAllSets(c);
    expect(c.textContent).toContain('Next exercise — or finish');
    expect(c.querySelector('[data-testid="fit-free-count"]')?.textContent).toBe('Sets logged: 3');

    click(button(c, 'Finish'));
    const done = c.querySelector('[data-testid="fit-done"]')!;
    expect(done.textContent).toContain('With Pro you can save this workout as your own routine.');
    expect(done.querySelector('input[type="checkbox"]')).toBeNull();
    click(button(c, 'Save workout'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].routineId).toBe('free');
    expect(c.querySelector('[data-testid="fit-history"]')?.textContent).toContain('Free workout');
  });

  it('Pro saves the free workout and the new routine in one go', () => {
    const onSave = vi.fn();
    const c = render(screen({ isPro: true, onSave }));
    click(button(c, 'Start Free workout'));
    pick(c, 'Squat');
    doAllSets(c);
    click(button(c, 'Finish'));
    click(c.querySelector('[data-testid="fit-done"] input[type="checkbox"]'));
    type(c.querySelector('[data-testid="fit-done"] input:not([type])'), 'Leg blast');
    click(button(c, 'Save workout'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [entry, routine] = onSave.mock.calls[0];
    expect(entry.routineId).toBe('free');
    expect(routine).toMatchObject({
      name: 'Leg blast',
      steps: [{ ex: 'squat', sets: 3, reps: 15 }],
    });
    expect(c.querySelector('[data-testid="fit-my"]')?.textContent).toContain('Leg blast');
    expect(c.querySelector('[data-testid="fit-history"]')?.textContent).toContain('Free workout');
  });
});

describe('MonoMiscare — my routines', () => {
  it('Free sees the Pro note and cannot create', () => {
    const c = render(screen({}));
    expect(c.querySelector('[data-testid="fit-my-pro"]')).toBeTruthy();
    expect(button(c, /Create routine/)).toBeUndefined();
  });

  it('keeps starting an existing custom routine after Pro lapses', () => {
    const r = newCustomRoutine('Core', [exerciseStep('plank')])!;
    const c = render(screen({ store: { log: [], custom: [r] } }));
    expect(button(c, 'Edit Core')).toBeUndefined();
    click(button(c, 'Start Core'));
    expect(c.querySelector('#fit-player-title')?.textContent).toBe('Core');
    expect(c.querySelector('.mono-fit-stage h3')?.textContent).toBe('Plank');
  });

  it('Pro builds, schedules, edits and deletes a routine', () => {
    const c = render(screen({ isPro: true }));
    click(button(c, /Create routine/));
    const builder = c.querySelector('[data-testid="fit-builder"]')!;
    expect(builder).toBeTruthy();
    expect(button(c, 'Save routine')!.disabled).toBe(true);

    pick(c, 'Squat');
    pick(c, 'Plank');
    expect(c.querySelector('[data-testid="fit-b-step-squat"]')).toBeTruthy();
    click(button(c, 'Move Plank up'));
    const order = Array.from(c.querySelectorAll('.mono-fit-step .mono-fit-name')).map(
      (n) => n.textContent,
    );
    expect(order).toEqual(['Plank', 'Squat']);
    type(builder.querySelector('input[maxlength]'), 'Morning core');
    click(button(c, 'Save routine'));

    const my = c.querySelector('[data-testid="fit-my"]')!;
    expect(my.textContent).toContain('Morning core');
    expect(my.textContent).toContain('Exercises: 2');

    click(button(c, 'Schedule Morning core'));
    click(button(c, 'Mon'));
    expect(my.textContent).toContain('Scheduled: Mon');

    click(button(c, 'Edit Morning core'));
    click(button(c, 'Remove Squat'));
    click(button(c, 'Save routine'));
    expect(c.querySelector('[data-testid="fit-my"]')?.textContent).toContain('Exercises: 1');

    click(button(c, 'Edit Morning core'));
    click(button(c, 'Delete routine'));
    const confirm = c.querySelector('.mono-fit-builder .mono-fit-confirm')!;
    click(
      Array.from(confirm.querySelectorAll('button')).find(
        (b) => b.textContent === 'Delete routine',
      ),
    );
    expect(c.querySelector('[data-testid="fit-my"]')).toBeNull();
    expect(c.textContent).toContain('No routines of your own yet.');
  });
});

describe('MonoMiscare — records', () => {
  const log = [
    logged('a', T0, [{ ex: 'gobletSquat', reps: 10, kg: 16 }]),
    logged('b', T0 + DAY, [{ ex: 'gobletSquat', reps: 10, kg: 18 }]),
  ];

  it('Free sees a teaser; the exercise page hides the chart', () => {
    const c = render(screen({ store: { log } }));
    expect(c.querySelector('[data-testid="fit-rec-pro"]')?.textContent).toContain(
      'Exercises with records so far: 1.',
    );
    expect(c.querySelector('[data-testid="fit-records"]')).toBeNull();
  });

  it('Pro lists records and opens the progress chart', () => {
    const c = render(screen({ store: { log }, isPro: true }));
    const list = c.querySelector('[data-testid="fit-records"]')!;
    expect(list.textContent).toContain('Goblet squat');
    expect(list.textContent).toContain('1RM ≈ 24 kg · 18 kg · Workouts: 2');

    click(button(c, 'Open progress for Goblet squat'));
    const prog = c.querySelector('[data-testid="fit-x-progress"]')!;
    expect(prog.textContent).toContain('Best: 1RM ≈ 24 kg');
    expect(prog.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBe(
      'Estimated one-rep max (kg), best set per workout: from 21.5 to 24 over 2 workouts',
    );
  });

  it('Pro gets a record toast after beating a best', () => {
    const c = render(
      screen({
        store: { log: [logged('a', T0, [{ ex: 'squat', reps: 10 }])] },
        isPro: true,
      }),
    );
    click(button(c, 'Start Free workout'));
    pick(c, 'Squat');
    doAllSets(c);
    click(button(c, 'Finish'));
    click(button(c, 'Save workout'));
    expect(c.querySelector('[data-testid="fit-record-toast"]')?.textContent).toBe(
      'New record: Squat — Reps: 15',
    );
  });
});
