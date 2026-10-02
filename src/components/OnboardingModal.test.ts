import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { ro } from '../lib/i18n/locales/ro';
import OnboardingModal from './OnboardingModal';

// Enables React 18 act() flushing outside RTL.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderModal(
  props: { onDone: () => void; onQuickStart: (g: string, t: string, startNow: boolean) => void },
  lang: 'en' | 'ro' = 'en',
) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const el: ReactElement = createElement(LocaleProvider, {
    locale: lang,
    dictionary: lang === 'ro' ? ro : undefined,
    onLocaleChange: () => {},
    children: createElement(OnboardingModal, props),
  });
  act(() => {
    root!.render(el);
  });
  return container;
}

function typeInto(input: HTMLInputElement, value: string) {
  act(() => {
    // Native setter bypasses React's value tracker so the change registers.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function clickButton(scope: ParentNode, text: string) {
  const btn = [...scope.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').includes(text),
  );
  expect(btn, `button "${text}"`).toBeDefined();
  act(() => {
    btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

describe('OnboardingModal quickstart', () => {
  it('asks for one objective first, with skip available', () => {
    const el = renderModal({ onDone: () => {}, onQuickStart: () => {} });
    expect(el.textContent).toContain('Name this intention');
    expect(el.textContent).toContain('Skip');
    expect(el.textContent).not.toContain('Ivy');
    expect(el.textContent).not.toContain('Eisenhower');
    expect(el.textContent).not.toContain('OKR');
    expect(el.textContent).not.toContain('Pro');
  });

  it('goal → suggested task → start calls onQuickStart with both', () => {
    const onQuickStart = vi.fn();
    const el = renderModal({ onDone: () => {}, onQuickStart });
    typeInto(el.querySelector('input')!, 'Launch the bakery site');
    clickButton(el, 'Next');
    // Rule-based suggestion for a launch goal, editable.
    const taskInput = el.querySelector('input') as HTMLInputElement;
    expect(taskInput.value).toBe('Write a one-paragraph scope');
    clickButton(el, 'Use this step');
    clickButton(el, 'Start focusing');
    expect(onQuickStart).toHaveBeenCalledTimes(1);
    expect(onQuickStart).toHaveBeenCalledWith(
      'Launch the bakery site',
      'Write a one-paragraph scope',
      true,
    );
  });

  it('“Later” saves the step without starting the timer', () => {
    const onQuickStart = vi.fn();
    const el = renderModal({ onDone: () => {}, onQuickStart });
    typeInto(el.querySelector('input')!, 'Finish an online course');
    clickButton(el, 'Next');
    clickButton(el, 'Use this step');
    clickButton(el, 'Later');
    expect(onQuickStart).toHaveBeenCalledTimes(1);
    expect(onQuickStart.mock.calls[0][0]).toBe('Finish an online course');
    expect(onQuickStart.mock.calls[0][2]).toBe(false);
  });

  it('keeps a user-typed task instead of the suggestion', () => {
    const onQuickStart = vi.fn();
    const el = renderModal({ onDone: () => {}, onQuickStart });
    typeInto(el.querySelector('input')!, 'Get fit');
    clickButton(el, 'Next');
    const taskInput = el.querySelector('input') as HTMLInputElement;
    typeInto(taskInput, 'Run 2km');
    clickButton(el, 'Use this step');
    clickButton(el, 'Start focusing');
    expect(onQuickStart).toHaveBeenCalledWith('Get fit', 'Run 2km', true);
  });

  it('starts the first step from the person’s own words, under its own title', () => {
    const el = renderModal({ onDone: () => {}, onQuickStart: () => {} }, 'ro');
    typeInto(el.querySelector('input')!, 'Să termin licența');
    clickButton(el, ro['onb.next']);
    const taskInput = el.querySelector('input') as HTMLInputElement;
    expect(taskInput.value).toBe('Să termin licența');
    expect(el.querySelector('h1')!.textContent).toBe(ro['onb.qs.stepTitle']);
    expect(el.querySelector('h1')!.textContent).not.toBe(ro['onb.qs.title']);
  });
});
