import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../../lib/i18n/LocaleContext';
import BoardTab from './BoardTab';
import type { BoardProps } from './types';
import type { Task, TaskStatus } from '../../lib/tasks';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const task = (id: string, status: TaskStatus): Task => ({
  id,
  projectId: 'p1',
  title: `Task ${id}`,
  status,
  priority: 'p2',
  createdAt: 1,
  updatedAt: 1,
});

function render(props: Partial<BoardProps> = {}): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const full: BoardProps = {
    projectId: 'p1',
    tasks: [],
    onTasksChange: () => {},
    board: { wipLimits: {}, columnLabels: {}, hidden: [] },
    commitBoard: () => {},
    isPro: false,
    ...props,
  };
  act(() => {
    root!.render(
      createElement(LocaleProvider, {
        locale: 'en',
        onLocaleChange: () => {},
        children: createElement(BoardTab, full),
      }),
    );
  });
  return container;
}

const forward = (c: HTMLElement, title: string) =>
  [...c.querySelectorAll('li')]
    .find((li) => li.textContent?.includes(title))!
    .querySelector('button[aria-label="Move forward"]') as HTMLButtonElement;

afterEach(() => {
  if (root && container) {
    act(() => root!.unmount());
    container.remove();
  }
  root = null;
  container = null;
});

describe('BoardTab WIP limits', () => {
  const full = [task('a', 'in_progress'), task('b', 'in_progress'), task('c', 'in_progress')];

  it('shows the default In progress limit to free users', () => {
    const c = render({ tasks: full });
    expect(c.textContent).toContain('3/3');
  });

  it('refuses to pull a task into a full In progress column', () => {
    const onTasksChange = vi.fn();
    const c = render({ tasks: [...full, task('d', 'pending')], onTasksChange });
    act(() => forward(c, 'Task d').click());
    expect(onTasksChange).not.toHaveBeenCalled();
    expect(c.querySelector('[role="status"]')!.textContent).toContain('is full (3)');
  });

  it('still lets a task move on to Blocked or Completed', () => {
    const onTasksChange = vi.fn();
    const c = render({ tasks: full, onTasksChange });
    act(() => forward(c, 'Task a').click());
    expect(onTasksChange).toHaveBeenCalledTimes(1);
  });

  it('offers a Focus button on In progress cards', () => {
    const onWorkFocus = vi.fn();
    const c = render({ tasks: [task('a', 'in_progress'), task('d', 'pending')], onWorkFocus });
    const btns = c.querySelectorAll('button[aria-label^="Focus on"]');
    expect(btns.length).toBe(1);
    act(() => (btns[0] as HTMLButtonElement).click());
    expect(onWorkFocus).toHaveBeenCalledWith('p1', 'a');
  });
});
