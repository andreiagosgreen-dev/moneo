import { describe, expect, it, afterEach } from 'vitest';
import { createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoCheckin from './MonoCheckin';
import MonoReportInsights from './MonoReportInsights';
import type { EnergyEntry } from '../lib/energy';
import type { Session } from '../lib/store';

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

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
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

const NOW = Date.UTC(2026, 8, 30, 12);

describe('MonoCheckin', () => {
  it('asks energy first, then mood, then shows a summary', () => {
    const seen: EnergyEntry[][] = [];
    function Host() {
      const [entries, setEntries] = useState<EnergyEntry[]>([]);
      return createElement(MonoCheckin, {
        entries,
        onChange: (e: EnergyEntry[]) => {
          seen.push(e);
          setEntries(e);
        },
        timezone: 'UTC',
        now: NOW,
      });
    }
    const c = render(createElement(Host));
    expect(c.querySelectorAll('[role="radiogroup"]')).toHaveLength(1);
    click(c.querySelector('[aria-label="Energy 4 of 5"]')!);
    expect(seen[0]).toEqual([
      expect.objectContaining({ id: 'daily-2026-9-30', level: 8, daily: true }),
    ]);
    expect(c.textContent).toContain('Energy 4/5');
    const mood = c.querySelector('[aria-label="Mood 5 of 5"]')!;
    expect(mood.getAttribute('aria-checked')).toBe('false');
    click(mood);
    expect(seen[1][0].mood).toBe(5);
    expect(c.querySelector('[data-testid="checkin-summary"]')?.textContent).toContain(
      'Energy 4/5 · Mood 5/5',
    );
    expect(c.querySelectorAll('[role="radiogroup"]')).toHaveLength(0);
    click(Array.from(c.querySelectorAll('button')).find((b) => b.textContent === 'Change')!);
    expect(c.querySelectorAll('[role="radiogroup"]')).toHaveLength(2);
    expect(c.querySelector('[aria-label="Energy 4 of 5"]')!.getAttribute('aria-checked')).toBe(
      'true',
    );
  });
});

describe('MonoReportInsights', () => {
  const history: Session[] = [];
  for (let i = 0; i < 6; i++) {
    history.push({ at: Date.UTC(2026, 8, 22 - i * 7, 10), min: 30 + i * 10 });
  }

  const insights = (isPro: boolean) =>
    createElement(
      MemoryRouter,
      null,
      createElement(MonoReportInsights, {
        habits: [],
        habitLog: {},
        history,
        energyLog: [],
        timezone: 'UTC',
        isPro,
        now: NOW,
      }),
    );

  it('shows the first card and a Pro teaser on Free', () => {
    const c = render(insights(false));
    expect(c.textContent).toContain('Strongest habit');
    expect(c.textContent).toContain('A few more days of data are needed.');
    expect(c.textContent).toContain('2 more insights with Pro');
    expect(c.querySelector('a[href="/pricing"]')).not.toBeNull();
    expect(c.textContent).not.toContain('Best and hardest week');
  });

  it('shows every card on Pro with charts', () => {
    const c = render(insights(true));
    expect(c.textContent).toContain('Best and hardest week');
    expect(c.textContent).toContain('Your best focus hour');
    expect(c.querySelectorAll('svg[role="img"]')).toHaveLength(2);
    expect(c.querySelector('a[href="/pricing"]')).toBeNull();
  });
});
