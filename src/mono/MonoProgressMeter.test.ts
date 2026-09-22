import { describe, expect, it, afterEach } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { ro } from '../lib/i18n/locales/ro';
import type { Locale } from '../lib/i18n/types';
import type { SessionImpact } from '../lib/progress';
import MonoProgressMeter from './MonoProgressMeter';

// Enables React 18 act() flushing outside RTL.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderMeter(locale: Locale, impact: SessionImpact): string {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const el: ReactElement = createElement(LocaleProvider, {
    locale,
    dictionary: locale === 'ro' ? ro : undefined,
    onLocaleChange: () => {},
    children: createElement(MonoProgressMeter, { impact }),
  });
  act(() => {
    root!.render(el);
  });
  return container.textContent ?? '';
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

const IMPACT: SessionImpact = {
  kind: 'project',
  projectId: 'p1',
  projectName: 'Launch site',
  projectColor: '#22c55e',
  sessionMin: 25,
  projectMinutes: 75,
  doneTasks: 2,
  totalTasks: 4,
  pct: 50,
  reachedMilestone: false,
  goalId: 'g1',
  goalTitle: 'Ship it',
  goalPct: 50,
  weekMin: 75,
};

describe('MonoProgressMeter', () => {
  it('shows the project payoff with percent, week and goal (en)', () => {
    const text = renderMeter('en', IMPACT);
    expect(text).toContain('You moved Launch site by 25m');
    expect(text).toContain('2 of 4 tasks done · 50%');
    expect(text).toContain('Goal “Ship it” is at 50%');
  });

  it('renders translated payoff (ro)', () => {
    const text = renderMeter('ro', IMPACT);
    expect(text).toContain('Ai mutat Launch site cu 25m');
  });

  it('celebrates the milestone at 100%', () => {
    const text = renderMeter('en', { ...IMPACT, pct: 100, reachedMilestone: true });
    expect(text).toContain('Milestone: Launch site is at 100%!');
  });

  it('renders nothing without a linked project', () => {
    const text = renderMeter('en', { kind: 'none', sessionMin: 25, weekMin: 25 });
    expect(text).toBe('');
  });
});
