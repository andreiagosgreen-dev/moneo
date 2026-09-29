import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoHabitsCheckin from './MonoHabitsCheckin';
import { MonoVacationBanner } from './MonoVacation';
import HabitsTab from '../components/life/HabitsTab';
import type { LifeCardProps } from '../components/life/types';
import type { Habit, HabitLog } from '../lib/habits';
import { localDayKey } from '../lib/projects';
import { addDays } from '../lib/dayKeys';

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

const today = localDayKey(Date.now());
const ago = (n: number) => addDays(today, -n);
const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  name: 'Read',
  frequency: 'daily',
  targetPerWeek: 7,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

function tab(habits: Habit[], habitLog: HabitLog, extra: Partial<LifeCardProps> = {}) {
  const props = {
    habits,
    habitsChange: vi.fn(),
    habitLog,
    habitLogChange: vi.fn(),
    timeOff: [],
    timeOffChange: vi.fn(),
    isPro: false,
    ...extra,
  } as unknown as LifeCardProps;
  return { props, el: createElement(HabitsTab, props) };
}

describe('habits polish', () => {
  it('Today check-in shows icon and streak text for Free', () => {
    const c = render(
      createElement(MonoHabitsCheckin, {
        habits: [habit({ icon: '📚' })],
        habitLog: { h1: [today, ago(1), ago(2)] },
        onHabitLogChange: () => {},
      }),
    );
    expect(c.textContent).toContain('📚');
    expect(c.textContent).toContain('3 days in a row');
  });

  it('time off keeps the check-in streak', () => {
    const c = render(
      createElement(MonoHabitsCheckin, {
        habits: [habit()],
        habitLog: { h1: [ago(3), ago(4)] },
        onHabitLogChange: () => {},
        timeOff: [ago(1), ago(2)],
      }),
    );
    expect(c.textContent).toContain('2 days in a row');
  });

  it('Free sees the streak but no success rate in the Life habits list', () => {
    const { el } = tab([habit()], { h1: [today, ago(1), ago(2), ago(3)] });
    const c = render(el);
    expect(c.textContent).toContain('4 days in a row');
    expect(c.querySelector('.mono-flame')).not.toBeNull();
    expect(c.textContent).not.toMatch(/\d+%/);
  });

  it('offers a freeze only when allowed, and applies it', () => {
    const missed = { h1: [ago(2), ago(3), ago(4)] };
    const { el, props } = tab([habit()], missed);
    const c = render(el);
    const btn = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'Save the streak',
    );
    expect(btn).toBeDefined();
    act(() => btn!.click());
    const next = (props.habitsChange as ReturnType<typeof vi.fn>).mock.calls[0][0] as Habit[];
    expect(next[0].frozen).toEqual([ago(1)]);
  });

  it('no freeze when yesterday was done or the streak is short', () => {
    for (const log of [{ h1: [ago(1), ago(2), ago(3)] }, { h1: [ago(2), ago(3)] }]) {
      const { el } = tab([habit()], log);
      const c = render(el);
      expect(c.textContent).not.toContain('Save the streak');
      act(() => root!.unmount());
      container!.remove();
      root = null;
      container = null;
    }
  });

  it('vacation banner shows the end date and ends the vacation', () => {
    const onChange = vi.fn();
    const off = [today, addDays(today, 1), addDays(today, 2)];
    const c = render(
      createElement(MonoVacationBanner, { timeOff: [ago(1), ...off], onChange, todayKey: today }),
    );
    expect(c.textContent).toContain("You're on vacation until");
    act(() => (c.querySelector('button') as HTMLButtonElement).click());
    expect(onChange).toHaveBeenCalledWith([ago(1)]);
  });
});
