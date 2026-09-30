import { describe, expect, it, afterEach, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { createBlock, type TimeBlock } from '../lib/timeBlocks';
import CalendarCard from './CalendarCard';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function setViewport(narrow: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: narrow && query.includes('max-width'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

function render(el: ReactElement): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(LocaleProvider, { locale: 'en', onLocaleChange: () => {}, children: el }),
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
  vi.unstubAllGlobals();
});

const card = (props: { isPro?: boolean; blocks?: TimeBlock[]; blocksChange?: () => void }) =>
  createElement(CalendarCard, {
    history: [],
    projects: [],
    timezone: 'UTC',
    isPro: props.isPro ?? false,
    blocks: props.blocks ?? [],
    blocksChange: props.blocksChange ?? vi.fn(),
  });

const pressed = (el: HTMLElement) =>
  el.querySelector('button[aria-pressed="true"]')?.textContent?.trim();

describe('CalendarCard default view', () => {
  it('phones start on the compact list, not seven stacked timelines', () => {
    setViewport(true);
    const el = render(card({}));
    expect(pressed(el)).toBe('List');
    expect(el.querySelector('.h-64')).toBeNull();
    expect(el.textContent).toContain('No blocks yet');
    expect(el.querySelectorAll('li')).toHaveLength(0);
  });

  it('the list shows all seven days once there is a block', () => {
    setViewport(true);
    const block = createBlock({ label: 'Deep work', weekday: 1, startMin: 540, endMin: 600 })!;
    const el = render(card({ blocks: [block] }));
    expect(el.querySelectorAll('ul.mt-3 > li')).toHaveLength(7);
    expect(el.textContent).toContain('Deep work');
  });

  it('wider screens keep the week grid', () => {
    setViewport(false);
    const el = render(card({}));
    expect(pressed(el)).toBe('Week');
    expect(el.querySelectorAll('.h-64')).toHaveLength(7);
  });

  it('Pro can delete a block from the list', () => {
    setViewport(true);
    const block = createBlock({ label: 'Deep work', weekday: 1, startMin: 540, endMin: 600 })!;
    const blocksChange = vi.fn();
    const el = render(card({ isPro: true, blocks: [block], blocksChange }));
    const del = el.querySelector('button[aria-label*="Deep work"]') as HTMLButtonElement;
    expect(del).not.toBeNull();
    act(() => {
      del.click();
    });
    expect(blocksChange).toHaveBeenCalledWith([]);
  });
});
