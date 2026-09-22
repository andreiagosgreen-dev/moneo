import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { STORAGE_KEYS } from '../lib/storage/storageKeys';
import AgileCard from './AgileCard';
import type { AgileProps } from './agile/types';

// Enables React 18 act() flushing outside RTL.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const BASE_PROPS: AgileProps = {
  projects: [],
  tasks: [],
  onTasksChange: () => {},
  sprints: [],
  sprintsChange: () => {},
  phases: [],
  phasesChange: () => {},
  selectedProjectId: null,
  onSelectProject: () => {},
};

function renderCard(): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const el: ReactElement = createElement(LocaleProvider, {
    locale: 'en',
    onLocaleChange: () => {},
    children: createElement(AgileCard, BASE_PROPS),
  });
  act(() => {
    root!.render(el);
  });
  return container;
}

function buttonTexts(scope: ParentNode): string[] {
  return [...scope.querySelectorAll('button')].map((b) => b.textContent ?? '');
}

beforeEach(() => {
  localStorage.clear();
});

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

describe('AgileCard advanced-planning gate', () => {
  it('hides methodology tabs behind one toggle for new users', () => {
    const el = renderCard();
    const texts = buttonTexts(el);
    expect(texts.some((x) => x.includes('Show advanced planning'))).toBe(true);
    expect(texts).not.toContain('Board');
    expect(texts).not.toContain('Sprints');
    expect(texts).not.toContain('Timeline');
    expect(texts).not.toContain('Waterfall');
  });

  it('reveals the tabs after enabling, and persists the choice', () => {
    const el = renderCard();
    const show = [...el.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Show advanced planning'),
    )!;
    act(() => {
      show.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const texts = buttonTexts(el);
    expect(texts).toContain('Board');
    expect(texts).toContain('Waterfall');
    expect(localStorage.getItem(STORAGE_KEYS.advancedPlanning)).toBe('true');
  });

  it('keeps tabs visible for users who already have sprints', () => {
    localStorage.setItem(
      STORAGE_KEYS.sprints,
      JSON.stringify([
        {
          id: 's1',
          projectId: 'p1',
          name: 'Sprint 1',
          startAt: 1,
          endAt: 2,
          taskIds: [],
          status: 'planned',
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    );
    const el = renderCard();
    expect(buttonTexts(el)).toContain('Board');
  });
});
