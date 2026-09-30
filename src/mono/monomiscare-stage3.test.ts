import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { buildProgram } from '../lib/fitness/program';
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
  onSave?: (entry: WorkoutEntry) => void;
  onChange?: (next: WorkoutStore) => void;
}

function Stateful(p: ScreenProps) {
  const [store, setStore] = useState<WorkoutStore>(p.store ?? { log: [] });
  return createElement(MonoMiscare, {
    store,
    habits: [],
    isPro: p.isPro ?? false,
    onSave: (entry: WorkoutEntry) => {
      p.onSave?.(entry);
      setStore((s) => ({ ...s, log: [...s.log, entry] }));
    },
    onDelete: vi.fn(),
    onChange: (next: WorkoutStore) => {
      p.onChange?.(next);
      setStore(next);
    },
  });
}

const screen = (p: ScreenProps) => createElement(Stateful, p);

const button = (c: Element, text: string | RegExp) =>
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
const type = (el: Element | null | undefined, value: string) => {
  expect(el).toBeTruthy();
  act(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(el, value);
    el!.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
/** A chip inside one of the program questions. */
const chip = (c: Element, question: string, text: string) =>
  button(c.querySelector(`fieldset[aria-labelledby="fit-pp-q-${question}"]`)!, text);
const field = (c: Element, label: string) =>
  Array.from(c.querySelectorAll('label'))
    .find((l) => l.textContent?.startsWith(label))
    ?.querySelector('input');

describe('MonoMiscare — cardio log', () => {
  it('logs a ride with distance and shows the speed in history (Free)', () => {
    const onSave = vi.fn();
    const c = render(screen({ onSave }));
    click(button(c, 'Log cardio'));
    const form = c.querySelector('[data-testid="fit-cardio-form"]')!;
    expect(form).toBeTruthy();
    expect(form.textContent).toContain('Add the distance to see your pace.');

    click(button(form, 'Ride'));
    type(field(form, 'Time, min'), '60');
    type(field(form, 'Distance, km'), '20');
    expect(c.querySelector('[data-testid="fit-cardio-pace"]')?.textContent).toBe('Pace: 20 km/h');
    click(button(form, 'Save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      routineId: 'cardio-cycle',
      durationSec: 3600,
      km: 20,
      sets: [],
    });
    expect(c.querySelector('[data-testid="fit-cardio-form"]')).toBeNull();
    expect(c.textContent).toContain('Workout saved.');
    const history = c.querySelector('[data-testid="fit-history"]')!.textContent;
    expect(history).toContain('Ride');
    expect(history).toContain('20 km · 20 km/h');
  });

  it('shows a run pace per km and refuses an empty time', () => {
    const onSave = vi.fn();
    const c = render(screen({ onSave }));
    click(button(c, 'Log cardio'));
    const form = c.querySelector('[data-testid="fit-cardio-form"]')!;
    type(field(form, 'Distance, km'), '5');
    expect(c.querySelector('[data-testid="fit-cardio-pace"]')?.textContent).toBe('Pace: 6:00 /km');
    type(field(form, 'Time, min'), '0');
    click(button(form, 'Save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(form.querySelector('[role="alert"]')).toBeTruthy();
    click(button(form, '‹ Cancel'));
    expect(c.querySelector('[data-testid="fit-cardio-form"]')).toBeNull();
  });
});

describe('MonoMiscare — personal program', () => {
  it('Free sees what Pro adds and cannot build', () => {
    const c = render(screen({}));
    expect(c.querySelector('[data-testid="fit-pp-pro"]')?.textContent).toBe(
      'A personal program is part of Pro.',
    );
    expect(button(c, 'Build my program')).toBeUndefined();
  });

  it('Pro answers the questions, gets this week and starts a session', () => {
    const onChange = vi.fn();
    const c = render(screen({ isPro: true, onChange }));
    click(button(c, 'Build my program'));
    const setup = c.querySelector('[data-testid="fit-pp-setup"]')!;
    expect(setup).toBeTruthy();
    click(chip(setup, 'goal', 'Get stronger'));
    click(chip(setup, 'level', 'Beginner'));
    click(chip(setup, 'place', 'Gym'));
    expect(setup.querySelector('fieldset[aria-labelledby="fit-pp-q-gear"]')).toBeNull();
    click(chip(setup, 'days', '4'));
    click(chip(setup, 'min', '45 min'));
    click(chip(setup, 'weeks', '4'));
    expect(setup.textContent).toContain('Sessions a week: 4 · about 45 min · Weeks: 4');
    click(button(setup, 'Create my program'));

    const saved = onChange.mock.calls[onChange.mock.calls.length - 1][0] as WorkoutStore;
    expect(saved.program?.answers).toMatchObject({ goal: 'strength', place: 'gym', days: 4 });
    const active = c.querySelector('[data-testid="fit-pp-active"]')!;
    expect(active.textContent).toContain('Week 1 of 4');
    expect(active.textContent).toContain('This week: 0 of 4 sessions done');
    const sessions = c.querySelector('[data-testid="fit-pp-sessions"]')!;
    expect(sessions.textContent).toContain('Program A: Upper body');
    expect(sessions.textContent).toContain('Program B: Lower body');
    expect(c.querySelector('.mono-fit-week .mono-fit-num')?.textContent).toBe('0/4');

    click(button(c, 'Start Program A: Upper body'));
    expect(c.querySelector('#fit-player-title')?.textContent).toBe('Program A: Upper body');
  });

  it('Pro changes the answers and ends the program', () => {
    const program = buildProgram({
      goal: 'mobility',
      level: 1,
      place: 'home',
      gear: [],
      days: 2,
      minutes: 15,
      weeks: 6,
    })!;
    const c = render(screen({ isPro: true, store: { log: [], program } }));
    expect(c.querySelector('[data-testid="fit-pp-sessions"]')?.textContent).toContain(
      'Program A: Mobility',
    );
    click(button(c, 'Change answers'));
    const setup = c.querySelector('[data-testid="fit-pp-setup"]')!;
    expect(chip(setup, 'goal', 'Move better')?.getAttribute('aria-pressed')).toBe('true');
    click(chip(setup, 'goal', 'Stay in shape'));
    click(button(setup, 'Rebuild program'));
    expect(c.querySelector('[data-testid="fit-pp-sessions"]')?.textContent).toContain(
      'Program A: Full body',
    );

    click(button(c, 'End program'));
    const confirm = c.querySelector('[data-testid="fit-pp"] .mono-fit-confirm')!;
    click(button(confirm, 'End program'));
    expect(c.querySelector('[data-testid="fit-pp-active"]')).toBeNull();
    expect(button(c, 'Build my program')).toBeTruthy();
  });

  it('keeps a running program startable after Pro lapses', () => {
    const answers = {
      goal: 'fit' as const,
      level: 1 as const,
      place: 'home' as const,
      gear: [],
      days: 3,
      minutes: 30,
      weeks: 4,
    };
    const running = buildProgram(answers)!;
    const c = render(screen({ store: { log: [], program: running } }));
    expect(c.querySelector('[data-testid="fit-pp-active"]')).toBeTruthy();
    expect(button(c, 'Change answers')).toBeUndefined();
    click(button(c, 'Start Program A: Conditioning'));
    expect(c.querySelector('#fit-player-title')?.textContent).toBe('Program A: Conditioning');
  });

  it('shows the finish after the last week', () => {
    const old = buildProgram(
      { goal: 'general', level: 1, place: 'home', gear: [], days: 3, minutes: 30, weeks: 4 },
      Date.now() - 6 * 7 * 86_400_000,
    )!;
    const c = render(screen({ isPro: true, store: { log: [], program: old } }));
    const done = c.querySelector('[data-testid="fit-pp-done"]')!;
    expect(done.textContent).toContain('Program complete');
    expect(done.textContent).toContain('You finished all 4 weeks.');
    expect(button(done, 'Build the next program')).toBeTruthy();
  });
});
