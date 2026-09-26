import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoFocus from './MonoFocus';

// Enables React 18 act() flushing outside RTL.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(el: ReactElement): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(el);
  });
  return container;
}

function screen(overrides = {}) {
  return createElement(LocaleProvider, {
    locale: 'en',
    onLocaleChange: () => {},
    children: createElement(MonoFocus, {
      mode: 'focus',
      running: false,
      remaining: 1500,
      total: 1500,
      focusMin: 25,
      intention: '',
      onIntention: () => {},
      onIntentionEnter: () => {},
      areas: [],
      selectedAreaId: null,
      onSelectArea: () => {},
      projects: [{ id: 'p1', name: 'Licență' }],
      selectedProjectId: 'p1',
      onSelectProject: () => {},
      tasks: [],
      selectedTaskId: null,
      onSelectTask: () => {},
      stats: { sessions: 3, focusMin: 75, done: 2 },
      upNext: [{ id: 't1', title: 'Recitește capitolul 2', meta: '25m', done: false }],
      summary: null,
      onDismissSummary: () => {},
      onToggle: () => {},
      onReset: () => {},
      onPreset: () => {},
      onToggleTask: () => {},
      onSeePlan: () => {},
      ...overrides,
    }),
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

describe('MonoFocus', () => {
  it('renders greeting, timer, stats and up next', () => {
    const c = render(screen());
    expect(c.textContent).toContain('Ready to focus.');
    expect(c.textContent).toContain('25:00');
    expect(c.textContent).toContain('New session');
    expect(c.textContent).toContain('Sessions');
    expect(c.textContent).toContain('Recitește capitolul 2');
    const projectSelect = c.querySelector('#mono-project') as HTMLSelectElement;
    expect(projectSelect.value).toBe('p1');
  });

  it('shows running state + pause label', () => {
    const c = render(screen({ running: true, remaining: 1044 }));
    expect(c.textContent).toContain('Session running');
    expect(c.textContent).toContain('17:24');
    expect(c.textContent).toContain('Pause');
  });

  it('shows break state with the mode label', () => {
    const c = render(screen({ mode: 'short', remaining: 300, total: 300 }));
    expect(c.textContent).toContain('Short break');
  });

  it('fires preset + toggle + see-plan callbacks', () => {
    const onPreset = vi.fn();
    const onToggle = vi.fn();
    const onSeePlan = vi.fn();
    const c = render(screen({ onPreset, onToggle, onSeePlan }));
    const chip5 = Array.from(c.querySelectorAll('button')).find((b) => b.textContent === '5 min')!;
    act(() => {
      chip5.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPreset).toHaveBeenCalledWith(5);
    const start = Array.from(c.querySelectorAll('button')).find((b) => b.textContent === 'Start')!;
    act(() => {
      start.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onToggle).toHaveBeenCalledTimes(1);
    const see = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'Open plan',
    )!;
    act(() => {
      see.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSeePlan).toHaveBeenCalledTimes(1);
  });

  it('offers the four atmospheres and reports the chosen one', () => {
    const onAtmosphere = vi.fn();
    const c = render(screen({ onAtmosphere }));
    const names = [
      'Paper',
      'Sanctuary',
      'Clear',
      'Ritual',
      'Dawn',
      'Studio',
      'Chapter',
      'Shore',
      'Night',
      'Wax',
      'Snow',
      'Charcoal',
      'Garden',
      'Clay',
      'Ink',
      'Aurora',
      'Stone',
      'Honey',
      'Sea',
      'Lamp',
    ];
    for (const name of names) {
      expect(c.textContent).toContain(name);
    }
    const sanctuary = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'Sanctuary',
    )!;
    act(() => {
      sanctuary.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onAtmosphere).toHaveBeenCalledWith('sanctuar');
  });

  it('shows empty plan hint when up next is empty', () => {
    const onSeePlan = vi.fn();
    const c = render(screen({ upNext: [], onSeePlan }));
    expect(c.textContent).toContain('No plan yet. Write today’s list first.');
    expect(c.textContent).toContain("Today's plan");
    const write = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === "Write today's plan",
    )!;
    act(() => {
      write.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSeePlan).toHaveBeenCalledTimes(1);
  });

  it('shows the completion summary with feedback buttons', () => {
    const onFeedback = vi.fn();
    const c = render(screen({ summary: { id: 1, minutes: 25 }, estimatePomodoros: 1, onFeedback }));
    expect(c.textContent).toContain('Focus session complete');
    const fb = Array.from(c.querySelectorAll('button')).filter((b) =>
      ['Done', 'Continue', 'Blocked', 'Off estimate'].includes(b.textContent ?? ''),
    );
    expect(fb.length).toBe(4);
    act(() => {
      fb[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onFeedback).toHaveBeenCalledTimes(1);
  });
});
