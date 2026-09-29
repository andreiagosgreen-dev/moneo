import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import MonoRepeatPicker from './MonoRepeatPicker';
import type { RepeatRule } from '../lib/recurrence';

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

function Harness({
  initial,
  spy,
}: {
  initial: RepeatRule | null;
  spy: (r: RepeatRule | null) => void;
}) {
  const [rule, setRule] = useState<RepeatRule | null>(initial);
  return createElement(MonoRepeatPicker, {
    value: rule,
    // 2026-9-30 is a Wednesday.
    dueKey: '2026-9-30',
    onChange: (r: RepeatRule | null) => {
      spy(r);
      setRule(r);
    },
  });
}

function picker(initial: RepeatRule | null = null, spy = vi.fn()) {
  return createElement(LocaleProvider, {
    locale: 'en',
    onLocaleChange: () => {},
    children: createElement(Harness, { initial, spy }),
  });
}

const select = (c: HTMLElement, value: string) =>
  act(() => {
    const el = c.querySelector('select[aria-label="Repeat"]') as HTMLSelectElement;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

describe('MonoRepeatPicker', () => {
  it('shows only the kind select when not repeating', () => {
    const c = render(picker());
    expect(c.querySelectorAll('select')).toHaveLength(1);
    expect(c.querySelector('input')).toBeNull();
    expect(c.querySelector('.mono-repeat-sum')).toBeNull();
  });

  it('weekly seeds the due weekday; chips toggle and the last one stays', () => {
    const spy = vi.fn();
    const c = render(picker(null, spy));
    select(c, 'weeks');
    expect(spy).toHaveBeenLastCalledWith({ kind: 'weeks', every: 1, weekdays: [2] });
    const chips = Array.from(c.querySelectorAll('.mono-chip')) as HTMLButtonElement[];
    expect(chips).toHaveLength(7);
    expect(chips[2].getAttribute('aria-pressed')).toBe('true');
    act(() => chips[0].click());
    expect(spy).toHaveBeenLastCalledWith({ kind: 'weeks', every: 1, weekdays: [0, 2] });
    expect(c.querySelector('.mono-repeat-sum')!.textContent).toBe('↻ Weekly on Mon, Wed');
    act(() => chips[0].click());
    act(() => chips[2].click());
    expect(spy).toHaveBeenLastCalledWith({ kind: 'weeks', every: 1, weekdays: [2] });
  });

  it('every N days shows a number field and a plural summary', () => {
    const spy = vi.fn();
    const c = render(picker(null, spy));
    select(c, 'everyDays');
    const input = c.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.value).toBe('2');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, '5');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(spy).toHaveBeenLastCalledWith({ kind: 'days', every: 5 });
    expect(c.querySelector('.mono-repeat-sum')!.textContent).toBe('↻ Every 5 days');
  });

  it('monthly seeds the due day and warns about short months past the 28th', () => {
    const c = render(picker());
    select(c, 'months');
    expect(c.querySelector('.mono-repeat-sum')!.textContent).toBe('↻ Monthly on day 30');
    expect(c.textContent).toContain('In shorter months: the last day');
  });

  it('"none" clears the rule', () => {
    const spy = vi.fn();
    const c = render(picker({ kind: 'weekdays' }, spy));
    expect(c.querySelector('.mono-repeat-sum')!.textContent).toBe('↻ Weekdays');
    select(c, 'none');
    expect(spy).toHaveBeenLastCalledWith(null);
  });
});
