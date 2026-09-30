import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoTemplates from './MonoTemplates';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(el: ReactElement): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(MemoryRouter, {
        children: createElement(LocaleProvider, {
          locale: 'en',
          onLocaleChange: () => {},
          children: el,
        }),
      }),
    );
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

const card = (el: HTMLElement, id: string) =>
  el.querySelector(`[data-testid="tpl-${id}"]`) as HTMLElement;
const buttons = (el: HTMLElement) => Array.from(el.querySelectorAll('button'));
const click = (b: Element) =>
  act(() => {
    (b as HTMLElement).click();
  });

describe('MonoTemplates', () => {
  it('Free sees 3 usable cards and 5 locked ones linking to pricing', () => {
    const el = render(
      createElement(MonoTemplates, {
        isPro: false,
        canCreate: true,
        hasProjects: false,
        onCreate: vi.fn(),
      }),
    );
    expect(el.querySelectorAll('.mono-tpl-card')).toHaveLength(8);
    expect(el.querySelectorAll('button[aria-label^="Use "]')).toHaveLength(3);
    const locked = el.querySelectorAll('a[href="/pricing"]');
    expect(locked).toHaveLength(5);
    const moving = card(el, 'moving');
    expect(moving.textContent).toContain('Moving house');
    expect(moving.textContent).toContain('Pro');
    expect(moving.querySelector('a')?.getAttribute('href')).toBe('/pricing');
    expect(moving.querySelector('button')).toBeNull();
  });

  it('Pro sees 8 usable cards', () => {
    const el = render(
      createElement(MonoTemplates, {
        isPro: true,
        canCreate: true,
        hasProjects: false,
        onCreate: vi.fn(),
      }),
    );
    expect(el.querySelectorAll('button[aria-label^="Use "]')).toHaveLength(8);
    expect(el.querySelector('a[href="/pricing"]')).toBeNull();
  });

  it('shows task and habit counts', () => {
    const el = render(
      createElement(MonoTemplates, {
        isPro: true,
        canCreate: true,
        hasProjects: false,
        onCreate: vi.fn(),
      }),
    );
    expect(card(el, 'exam').textContent).toContain('Tasks: 5 · Habits: 1');
    expect(card(el, 'moving').textContent).toContain('Tasks: 6 · Habits: 0');
  });

  it('confirms inline: Use → Create calls onCreate once', () => {
    const onCreate = vi.fn();
    const el = render(
      createElement(MonoTemplates, { isPro: false, canCreate: true, hasProjects: false, onCreate }),
    );
    const exam = card(el, 'exam');
    click(exam.querySelector('button[aria-label="Use Exam prep"]')!);
    expect(onCreate).not.toHaveBeenCalled();
    const create = buttons(exam).find((b) => b.textContent === 'Create')!;
    expect(buttons(exam).some((b) => b.textContent === 'Cancel')).toBe(true);
    click(create);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith('exam');
    expect(buttons(exam).some((b) => b.textContent === 'Create')).toBe(false);
  });

  it('Cancel backs out without creating anything', () => {
    const onCreate = vi.fn();
    const el = render(
      createElement(MonoTemplates, { isPro: true, canCreate: true, hasProjects: false, onCreate }),
    );
    const sport = card(el, 'sport');
    click(sport.querySelector('button[aria-label="Use Get fit"]')!);
    click(buttons(sport).find((b) => b.textContent === 'Cancel')!);
    expect(onCreate).not.toHaveBeenCalled();
    expect(sport.querySelector('button[aria-label="Use Get fit"]')).not.toBeNull();
  });

  it('project limit: no Use buttons, one notice for the whole section', () => {
    const onCreate = vi.fn();
    const el = render(
      createElement(MonoTemplates, { isPro: false, canCreate: false, hasProjects: true, onCreate }),
    );
    expect(card(el, 'exam').querySelector('button')).toBeNull();
    expect(card(el, 'exam').textContent).not.toContain('Free includes 3 projects.');
    const notes = el.querySelectorAll('[role="note"]');
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toContain('Free includes 3 projects.');
    expect(notes[0].querySelector('a')?.getAttribute('href')).toBe('/pricing');
  });

  it('starts open with no projects and collapsed once there are some', () => {
    const empty = render(
      createElement(MonoTemplates, {
        isPro: false,
        canCreate: true,
        hasProjects: false,
        onCreate: vi.fn(),
      }),
    );
    expect((empty.querySelector('details') as HTMLDetailsElement).open).toBe(true);
    act(() => {
      root!.unmount();
    });
    container!.remove();

    const busy = render(
      createElement(MonoTemplates, {
        isPro: false,
        canCreate: true,
        hasProjects: true,
        onCreate: vi.fn(),
      }),
    );
    const details = busy.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toContain('Ready-made systems');
  });
});
