import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoTriage from './MonoTriage';
import type { Suggestion } from '../lib/triage';
import type { Task } from '../lib/tasks';

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

const task = (id: string, title: string): Task => ({
  id,
  projectId: '',
  title,
  status: 'pending',
  priority: 'p1',
  createdAt: 1,
  updatedAt: 1,
});

const TASKS = [task('a', 'Call the bank'), task('b', 'Buy stamps')];
const CARDS: Suggestion[] = TASKS.map((x) => ({
  key: `inbox:${x.id}`,
  reason: 'inbox',
  taskId: x.id,
  title: x.title,
}));

function triage(props: Partial<Parameters<typeof MonoTriage>[0]> = {}) {
  return createElement(LocaleProvider, {
    locale: 'en',
    onLocaleChange: () => {},
    children: createElement(MonoTriage, {
      suggestions: CARDS,
      tasks: TASKS,
      onAction: () => ({ ok: true }),
      onFinish: () => {},
      ...props,
    }),
  });
}

const click = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
const button = (c: HTMLElement, label: string) =>
  Array.from(c.querySelectorAll('button')).find((b) => b.textContent === label)!;

describe('MonoTriage', () => {
  it('shows one card at a time with its reason, progress and pills', () => {
    const c = render(triage());
    expect(c.textContent).toContain('From your inbox');
    expect(c.textContent).toContain('1 of 2');
    expect(c.querySelector('#mono-triage-title')!.textContent).toBe('Call the bank');
    expect(c.textContent).toContain('High');
    expect(c.textContent).not.toContain('Buy stamps');
  });

  it('walks through the cards and finishes once', () => {
    const onAction = vi.fn(() => ({ ok: true }));
    const onFinish = vi.fn();
    const c = render(triage({ onAction, onFinish }));
    click(button(c, 'Today'));
    expect(onAction).toHaveBeenLastCalledWith(CARDS[0], 'today');
    expect(c.textContent).toContain('2 of 2');
    click(button(c, 'Later'));
    expect(onAction).toHaveBeenLastCalledWith(CARDS[1], 'later');
    expect(c.querySelector('[role="status"]')!.textContent).toBe('All sorted.');
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('stays on the card when today is full', () => {
    const c = render(triage({ onAction: () => ({ ok: false, reason: 'full' }) }));
    click(button(c, 'Today'));
    expect(c.querySelector('[role="alert"]')!.textContent).toBe('Today’s list is full.');
    expect(c.textContent).toContain('1 of 2');
  });

  it('offers an undo after a drop and returns to that card', () => {
    const onUndo = vi.fn();
    const c = render(triage({ onUndo }));
    click(button(c, 'Drop'));
    expect(c.textContent).toContain('2 of 2');
    click(button(c, 'Undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(c.textContent).toContain('1 of 2');
    expect(c.querySelector('#mono-triage-title')!.textContent).toBe('Call the bank');
  });

  it('maps number keys 1–4 to the actions', () => {
    const onAction = vi.fn(() => ({ ok: true }));
    const c = render(triage({ onAction }));
    const card = c.querySelector('.mono-triage-card')!;
    act(() => {
      card.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    });
    expect(onAction).toHaveBeenLastCalledWith(CARDS[0], 'tomorrow');
  });

  it('skip finishes without touching the rest', () => {
    const onAction = vi.fn(() => ({ ok: true }));
    const onFinish = vi.fn();
    const c = render(triage({ onAction, onFinish }));
    click(button(c, 'Skip'));
    expect(onAction).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(c.textContent).toContain('All sorted.');
  });
});
