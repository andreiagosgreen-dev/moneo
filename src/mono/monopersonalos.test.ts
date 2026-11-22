import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { MonoOsCommandDeck, MonoTopOsBar } from './MonoPersonalOsSuite';
import type { WorkoutStore } from '../lib/fitness/workouts';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const emptyWorkoutStore: WorkoutStore = {
  place: 'home',
  log: [],
};

afterEach(() => {
  if (root && container) {
    act(() => {
      root!.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  localStorage.clear();
});

describe('MonoPersonalOsSuite (Ideas #1–#10)', () => {
  it('renders MonoTopOsBar with XP rank pill, J.A.R.V.I.S. briefing button, and Share OS Card button', () => {
    const onGoGrowth = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        createElement(LocaleProvider, {
          locale: 'ro',
          onLocaleChange: () => {},
          children: createElement(MonoTopOsBar, {
            xp: { focus: 120, tasks: 80, habits: 40, phases: 0, projects: 0, total: 240 },
            osScore: 84,
            mindPct: 80,
            execPct: 90,
            bodyPct: 82,
            openTasks: 2,
            workoutStore: emptyWorkoutStore,
            onGoGrowth,
          }),
        }),
      );
    });

    expect(container.querySelector('[data-testid="mono-top-os-bar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="jarvis-voice-btn"]')?.textContent).toContain(
      'Vocal',
    );
    expect(container.querySelector('[data-testid="share-os-card-btn"]')?.textContent).toContain(
      'Cardul',
    );
  });

  it('cycles analog ingredients on click (Idea #9), switches to Atomic 1% & 5-Axis Radar (Idea #10 + #8), and opens Biometric Muscle Scanner (Idea #1 + #3)', () => {
    const onGo = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        createElement(LocaleProvider, {
          locale: 'ro',
          onLocaleChange: () => {},
          children: createElement(MonoOsCommandDeck, {
            dayKey: '2026-11-22',
            history: [{ id: 's1', at: Date.now() - 3600_000, min: 45 }],
            workoutStore: emptyWorkoutStore,
            mindPct: 75,
            execPct: 80,
            bodyPct: 70,
            habitsDoneToday: 2,
            habitsTotalToday: 3,
            onGo,
          }),
        }),
      );
    });

    // Idea #9: Switch goal to 'cut' and cycle morning protein swap
    const cutBtn = container.querySelector<HTMLButtonElement>('[data-testid="fuel-goal-cut"]')!;
    act(() => {
      cutBtn.click();
    });
    const protChip = container.querySelector<HTMLButtonElement>(
      '[data-testid="swap-morning-prot"]',
    )!;
    const initialText = protChip.textContent;
    expect(initialText).toContain('1/4');
    act(() => {
      protChip.click();
    });
    expect(protChip.textContent).toContain('2/4');
    expect(protChip.textContent).not.toBe(initialText);

    // Idea #10 + #8: Switch to Atomic Habits & 30D 5-Axis Radar tab
    const atomicTab = container.querySelector<HTMLButtonElement>('[data-testid="os-tab-atomic"]')!;
    act(() => {
      atomicTab.click();
    });
    expect(container.querySelector('[data-testid="os-panel-atomic"]')).toBeTruthy();
    const rescueBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="atomic-2min-btn"]',
    )!;
    act(() => {
      rescueBtn.click();
    });
    expect(rescueBtn.classList.contains('is-on')).toBe(true);

    // Idea #1 + #3 + #6: Switch to Biometric Muscle & 48h Recovery tab
    const bodyTab = container.querySelector<HTMLButtonElement>('[data-testid="os-tab-body"]')!;
    act(() => {
      bodyTab.click();
    });
    expect(container.querySelector('[data-testid="os-panel-body"]')).toBeTruthy();
    expect(container.querySelector('svg.mono-bmap')).toBeTruthy();
  });
});
