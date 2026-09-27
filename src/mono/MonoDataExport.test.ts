import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LocaleProvider } from '../lib/i18n/LocaleContext';
import { STORAGE_KEYS } from '../lib/storage/storageKeys';
import { buildExport, type CloudExport, type MoneoExport } from '../lib/dataExport';
import MonoDataExport from './MonoDataExport';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function memoryStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

function render(props: Parameters<typeof MonoDataExport>[0]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(LocaleProvider, {
        locale: 'en',
        onLocaleChange: () => {},
        children: createElement(MonoDataExport, props),
      }),
    );
  });
  return container;
}

function button(c: HTMLElement, label: string): HTMLButtonElement {
  const b = [...c.querySelectorAll('button')].find((x) => x.textContent === label);
  if (!b) throw new Error(`no button ${label}`);
  return b as HTMLButtonElement;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('MonoDataExport', () => {
  const storage = () =>
    memoryStorage({
      [STORAGE_KEYS.tasks]: '[{"id":"t1"}]',
      [STORAGE_KEYS.aiByok]: '{"provider":"gemini","key":"AIza-SECRET","webSearch":true}',
    });

  it('exports for free without the AI key, plus cloud rows when signed in', async () => {
    const onDownload = vi.fn<(d: MoneoExport) => void>();
    const cloud: CloudExport = {
      email: 'a@example.com',
      sessions: [],
      areas: [],
      settings: null,
      subscription: { status: 'free', planId: 'free', currentPeriodEnd: null },
    };
    const collectCloud = vi.fn(async () => cloud);
    const c = render({
      storage: storage(),
      user: { userId: 'u1', email: 'a@example.com' },
      collectCloud,
      onDownload,
    });
    expect(c.textContent).toContain('synced sessions');
    await act(async () => {
      button(c, 'Export all my data (JSON)').click();
    });
    await flush();
    expect(collectCloud).toHaveBeenCalledWith('u1', 'a@example.com');
    const data = onDownload.mock.calls[0][0];
    expect(JSON.stringify(data)).not.toContain('AIza-SECRET');
    expect(data.cloud).toEqual(cloud);
    expect(data.local[STORAGE_KEYS.tasks]).toEqual([{ id: 't1' }]);
    expect(c.textContent).toContain('Export downloaded.');
  });

  it('includes the AI key only after the user ticks the box; skips cloud when signed out', async () => {
    const onDownload = vi.fn<(d: MoneoExport) => void>();
    const collectCloud = vi.fn();
    const c = render({ storage: storage(), onDownload, collectCloud });
    const box = c.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    expect(box.checked).toBe(false);
    act(() => box.click());
    await act(async () => {
      button(c, 'Export all my data (JSON)').click();
    });
    await flush();
    expect(collectCloud).not.toHaveBeenCalled();
    expect(JSON.stringify(onDownload.mock.calls[0][0])).toContain('AIza-SECRET');
  });

  async function pickFile(c: HTMLElement, text: string) {
    const input = c.querySelector<HTMLInputElement>('input[type=file]')!;
    const file = new File([text], 'moneo-export.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
  }

  it('asks for confirmation, then replaces local data', async () => {
    const target = storage();
    const onImported = vi.fn();
    const c = render({ storage: target, onImported });
    const file = buildExport(memoryStorage({ [STORAGE_KEYS.goals]: '[{"id":"g1"}]' }));
    await pickFile(c, JSON.stringify(file));
    expect(c.querySelector('[role=alertdialog]')).not.toBeNull();
    expect(target.getItem(STORAGE_KEYS.tasks)).not.toBeNull();
    act(() => button(c, 'Replace data').click());
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(target.getItem(STORAGE_KEYS.tasks)).toBeNull();
    expect(target.getItem(STORAGE_KEYS.goals)).toBe('[{"id":"g1"}]');
  });

  it('shows a clear error for a non-Moneo file and changes nothing', async () => {
    const target = storage();
    const onImported = vi.fn();
    const c = render({ storage: target, onImported });
    await pickFile(c, JSON.stringify({ hello: 'world' }));
    expect(c.querySelector('[role=alert]')?.textContent).toBe('This is not a Moneo export file.');
    expect(c.querySelector('[role=alertdialog]')).toBeNull();
    expect(target.getItem(STORAGE_KEYS.tasks)).toBe('[{"id":"t1"}]');
    expect(onImported).not.toHaveBeenCalled();
  });
});
