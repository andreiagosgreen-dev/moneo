import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { loadProjects, type Project } from '../lib/projects';
import ProjectsCard from './ProjectsCard';
import type { Props } from './projects/types';

// Enables React 18 act() flushing outside RTL.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function makeProject(id: string, name: string): Project {
  return {
    id,
    name,
    color: '#22c55e',
    category: 'work',
    tags: [],
    createdAt: 1000,
    updatedAt: 1000,
  };
}

function renderCard(overrides: Partial<Props>): HTMLDivElement {
  const props: Props = {
    projects: [],
    history: [],
    areas: [],
    tasks: [],
    selectedProjectId: null,
    onSelectProject: () => {},
    onProjectsChange: () => {},
    onTasksChange: () => {},
    links: [],
    onLinksChange: () => {},
    goals: [],
    skills: [],
    objectives: [],
    savedFilters: [],
    onSavedFiltersChange: () => {},
    ...overrides,
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const el: ReactElement = createElement(MemoryRouter, {
    children: createElement(LocaleProvider, {
      locale: 'en',
      onLocaleChange: () => {},
      children: createElement(ProjectsCard, props),
    }),
  });
  act(() => {
    root!.render(el);
  });
  return container;
}

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function buttonByText(scope: ParentNode, text: string): HTMLButtonElement {
  const btn = [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!btn) throw new Error(`button "${text}" not found`);
  return btn;
}

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
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

describe('ProjectsCard inline edit', () => {
  it('keeps the other projects when one project is edited and saved', () => {
    const projects = [
      makeProject('p1', 'Alpha'),
      makeProject('p2', 'Beta'),
      makeProject('p3', 'Gamma'),
    ];
    let received: Project[] | null = null;
    const el = renderCard({ projects, onProjectsChange: (next) => (received = next) });

    click(el.querySelector('button[aria-label="Expand Beta"]')!);
    click(buttonByText(el, 'Edit'));
    const nameInput = [...el.querySelectorAll<HTMLInputElement>('input[type="text"]')].find(
      (i) => i.value === 'Beta',
    )!;
    typeInto(nameInput, 'Beta Renamed');
    click(buttonByText(el, 'Save'));

    expect(received).not.toBeNull();
    expect(received!.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(received!.find((p) => p.id === 'p2')?.name).toBe('Beta Renamed');
    expect(loadProjects().map((p) => p.name)).toEqual(['Alpha', 'Beta Renamed', 'Gamma']);
  });
});
