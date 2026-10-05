import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoTourTip from './MonoTourTip';
import MonoTrialNote from './MonoTrialNote';
import MonoFirstSteps from './MonoFirstSteps';

let root: Root | null = null;
let container: HTMLElement | null = null;

function render(el: ReactElement, locale: 'en' | 'ro' = 'en'): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(
        MemoryRouter,
        null,
        createElement(LocaleProvider, { locale, onLocaleChange: () => {}, children: el }),
      ),
    );
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const click = (el: Element | undefined | null) => {
  expect(el).toBeTruthy();
  act(() => (el as HTMLElement).click());
};
const button = (c: HTMLElement, text: string) =>
  Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

describe('trial tour tip', () => {
  it('shows the day, the suggestion and both buttons', () => {
    const onGo = vi.fn();
    const onDismiss = vi.fn();
    const c = render(createElement(MonoTourTip, { tip: 'move', onGo, onDismiss }));
    expect(c.textContent).toContain('Day 3 of your Pro trial');
    expect(c.textContent).toContain('A 10-minute workout');
    click(button(c, 'Open Move'));
    click(button(c, 'Not now'));
    expect(onGo).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe('trial note with summary', () => {
  it('shows what the user did in the last days of the trial', () => {
    const c = render(
      createElement(MonoTrialNote, {
        notice: { kind: 'left', days: 2 },
        summary: { focusMin: 200, sessions: 9, workouts: 2 },
      }),
    );
    expect(c.textContent).toContain('2 days of free Pro left');
    expect(c.querySelector('[data-testid="trial-summary"]')?.textContent).toMatch(
      /So far: .+ of focus in 9 rounds · workouts: 2/,
    );
    expect(c.querySelector('a[href="/pricing"]')).toBeTruthy();
  });

  it('skips the summary when nothing was done yet, and after the end', () => {
    const empty = render(
      createElement(MonoTrialNote, {
        notice: { kind: 'left', days: 3 },
        summary: { focusMin: 0, sessions: 0, workouts: 0 },
      }),
    );
    expect(empty.querySelector('[data-testid="trial-summary"]')).toBeNull();
  });
});

describe('first steps card', () => {
  it('offers the next step and hides the AI plan without Pro', () => {
    const handlers = {
      onTask: vi.fn(),
      onFocus: vi.fn(),
      onWorkout: vi.fn(),
      onPlan: vi.fn(),
      onTryTheme: vi.fn(),
      onDismiss: vi.fn(),
    };
    const c = render(
      createElement(MonoFirstSteps, {
        view: 'steps',
        progress: { done: { task: true, focus: true, try: false }, count: 2 },
        canAiPlan: false,
        ...handlers,
      }),
    );
    expect(c.textContent).toContain('2 of 3');
    expect(button(c, 'AI plan')).toBeUndefined();
    click(button(c, '10-min workout'));
    expect(handlers.onWorkout).toHaveBeenCalledOnce();
  });
});
