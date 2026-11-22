import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoHudCore, { computeHudMetrics } from './MonoHudCore';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

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

describe('MonoHudCore', () => {
  it('computes concentric ring scores and 14-day week-over-week velocity delta', () => {
    const now = Date.UTC(2026, 10, 22, 12, 0, 0);
    const day = 86_400_000;
    const m = computeHudMetrics({
      focusMinToday: 50,
      focusGoalMin: 100,
      tasksDone: 3,
      tasksTotal: 3,
      workoutsThisWeek: 2,
      workoutsGoal: 4,
      habitsDoneToday: 2,
      habitsTotalToday: 2,
      history: [
        { id: 'old', at: now - 10 * day, min: 50 },
        { id: 'recent1', at: now - 2 * day, min: 50 },
        { id: 'recent2', at: now - 1 * day, min: 50 },
      ],
      now,
    });
    expect(m.mindPct).toBe(50);
    expect(m.execPct).toBe(100);
    expect(m.bodyPct).toBe(75);
    expect(m.score).toBe(74);
    expect(m.prevWeekMin).toBe(50);
    expect(m.thisWeekMin).toBe(100);
    expect(m.deltaPct).toBe(100);
  });

  it('renders the 3-ring HUD and navigates on channel click', () => {
    const onGo = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        createElement(LocaleProvider, {
          locale: 'en',
          onLocaleChange: () => {},
          children: createElement(MonoHudCore, {
            focusMinToday: 60,
            focusGoalMin: 100,
            tasksDone: 2,
            tasksTotal: 4,
            workoutsThisWeek: 3,
            workoutsGoal: 3,
            habitsDoneToday: 3,
            habitsTotalToday: 3,
            history: [{ id: 's1', at: Date.now() - 3600_000, min: 60 }],
            onGo,
          }),
        }),
      );
    });
    expect(container.querySelector('.mono-hud-score')?.textContent).toBe('67');
    expect(container.querySelector('[data-testid="hud-delta"]')?.textContent).toBe('+100%');
    const moveBtn = container.querySelector<HTMLButtonElement>('.mono-hud-ch.is-body')!;
    act(() => {
      moveBtn.click();
    });
    expect(onGo).toHaveBeenCalledWith('move');
  });
});
