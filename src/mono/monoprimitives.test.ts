import { describe, expect, it, afterEach } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import MonoRing from './MonoRing';
import MonoPill from './MonoPill';
import MonoProgress from './MonoProgress';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function cleanup() {
  if (root && container) {
    act(() => {
      root!.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
}

function render(el: ReactElement): HTMLElement {
  cleanup();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(el);
  });
  return container;
}

afterEach(cleanup);

describe('MonoRing', () => {
  it('clamps below 0 and above 100', () => {
    const low = render(createElement(MonoRing, { value: -5, label: 'x' }));
    expect((low.firstElementChild as HTMLElement).dataset.value).toBe('0');
    const high = render(createElement(MonoRing, { value: 140, label: 'x' }));
    expect((high.firstElementChild as HTMLElement).dataset.value).toBe('100');
    const bar = high.querySelector('.mono-pring-bar')!;
    expect(Number(bar.getAttribute('stroke-dashoffset'))).toBeCloseTo(0);
  });

  it('exposes an accessible name and centered content', () => {
    const c = render(
      createElement(MonoRing, { value: 60, label: 'Today: 3 of 5', children: '60%' }),
    );
    const ring = c.querySelector('.mono-pring')!;
    expect(ring.getAttribute('role')).toBe('img');
    expect(ring.getAttribute('aria-label')).toBe('Today: 3 of 5');
    expect(c.querySelector('.mono-pring-center')!.textContent).toBe('60%');
    expect(c.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws no bar at zero and survives NaN', () => {
    const c = render(createElement(MonoRing, { value: Number.NaN, label: 'x' }));
    expect(c.querySelector('.mono-pring-track')).toBeTruthy();
    expect(c.querySelector('.mono-pring-bar')).toBeNull();
  });
});

describe('MonoPill', () => {
  it('renders a class per tone', () => {
    for (const tone of ['neutral', 'accent', 'danger', 'outline'] as const) {
      const c = render(createElement(MonoPill, { tone, children: 'x' }));
      expect(c.querySelector(`.mono-pill.mono-pill-${tone}`)).toBeTruthy();
    }
  });

  it('defaults to neutral and can be marked done', () => {
    const c = render(createElement(MonoPill, { done: true, children: 'x' }));
    expect(c.querySelector('.mono-pill-neutral.mono-pill-done')).toBeTruthy();
  });
});

describe('MonoProgress', () => {
  it('keeps the default markup unchanged', () => {
    const c = render(createElement(MonoProgress, { value: 140, label: 'p' }));
    const bar = c.querySelector('.mono-progress')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(bar.hasAttribute('data-tone')).toBe(false);
    expect(bar.hasAttribute('data-size')).toBe(false);
  });

  it('supports accent tone and small size', () => {
    const c = render(
      createElement(MonoProgress, { value: 30, label: 'p', tone: 'accent', size: 'sm' }),
    );
    const bar = c.querySelector('.mono-progress')!;
    expect(bar.getAttribute('data-tone')).toBe('accent');
    expect(bar.getAttribute('data-size')).toBe('sm');
  });
});
