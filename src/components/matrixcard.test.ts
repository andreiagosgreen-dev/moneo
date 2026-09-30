import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import type { Task } from '../lib/tasks';
import MatrixCard from './MatrixCard';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const chore: Task = {
  id: 'chore',
  projectId: 'p1',
  title: 'Planned chore',
  status: 'pending',
  priority: 'p2',
  createdAt: 1000,
  updatedAt: 1000,
};

function quadrantOf(planTaskIds?: Set<string>): string {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(LocaleProvider, {
        locale: 'en',
        onLocaleChange: () => {},
        children: createElement(MatrixCard, {
          tasks: [chore],
          history: [],
          onTasksChange: () => {},
          planTaskIds,
        }),
      }),
    );
  });
  const item = Array.from(container.querySelectorAll('li')).find((li) =>
    li.textContent?.includes('Planned chore'),
  );
  const box = item?.closest('ul')?.parentElement;
  return box?.querySelector('span')?.firstChild?.textContent ?? '';
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

describe('MatrixCard', () => {
  it('files an unplanned low-priority task under Eliminate', () => {
    expect(quadrantOf()).toBe('Eliminate');
  });

  it("files a task on today's plan under Do, not Eliminate", () => {
    expect(quadrantOf(new Set(['chore']))).toBe('Do');
  });
});
