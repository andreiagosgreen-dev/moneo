import { describe, expect, it, afterEach } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import type { Session } from '../lib/store';
import type { Project } from '../lib/projects';
import WeeklyRecapCard from './WeeklyRecapCard';

// Enables React 18 act() flushing outside RTL.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const NOW = Date.now();
const PROJECT: Project = {
  id: 'p1',
  name: 'Launch site',
  color: '#22c55e',
  category: 'work',
  tags: [],
  createdAt: NOW - 1000,
  updatedAt: NOW - 1000,
};

function renderCard(history: Session[]): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const el: ReactElement = createElement(LocaleProvider, {
    locale: 'en',
    onLocaleChange: () => {},
    children: createElement(WeeklyRecapCard, {
      history,
      projects: [PROJECT],
      tasks: [],
      goals: [],
      timezone: 'UTC',
    }),
  });
  act(() => {
    root!.render(el);
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

describe('WeeklyRecapCard', () => {
  it('shows the empty state before the first session', () => {
    const el = renderCard([]);
    expect(el.textContent).toContain('Weekly recap');
    expect(el.textContent).toContain('Finish one focus round');
  });

  it('renders the week total, top mover and share actions', () => {
    const el = renderCard([{ id: 's1', at: NOW, min: 25, projectId: 'p1' }]);
    expect(el.textContent).toContain('Weekly recap');
    expect(el.textContent).toContain('25m');
    expect(el.textContent).toContain('Launch site');
    expect(el.textContent).toContain('Share');
    expect(el.textContent).toContain('Save image');
  });
});
