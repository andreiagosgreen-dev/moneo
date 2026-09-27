import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildByokPath,
  clearByokKey,
  loadByokConfig,
  pathFromModelJson,
  saveByokConfig,
} from './byok';

beforeEach(() => {
  localStorage.clear();
});

describe('byok config', () => {
  it('defaults to local and round-trips save', () => {
    expect(loadByokConfig()).toEqual({ provider: 'local', key: '', webSearch: true });
    saveByokConfig({ provider: 'gemini', key: '  abc  ', webSearch: false });
    expect(loadByokConfig()).toEqual({ provider: 'gemini', key: 'abc', webSearch: false });
  });

  it('clears the key and returns to local', () => {
    saveByokConfig({ provider: 'openai', key: 'sk-test', webSearch: true });
    clearByokKey();
    expect(loadByokConfig()).toEqual({ provider: 'local', key: '', webSearch: true });
  });
});

describe('pathFromModelJson', () => {
  it('maps steps and sources onto a BuiltPath', () => {
    const { path, sources } = pathFromModelJson(
      { text: 'Learn math', horizonMonths: 6, hoursPerWeek: 5 },
      {
        steps: [
          { title: 'Arithmetic review', estimateMin: 50 },
          { title: 'Algebra basics', minutes: 75 },
        ],
        sources: ['https://example.com/math', 'not-a-url'],
      },
    );
    expect(path.tasks).toHaveLength(2);
    expect(path.tasks[0].title).toBe('Arithmetic review');
    expect(path.tasks[0].pomodoros).toBe(2);
    expect(sources).toEqual(['https://example.com/math']);
  });
});

describe('buildByokPath', () => {
  it('uses local when no key', async () => {
    const r = await buildByokPath({ text: 'Learn React', horizonMonths: 3, hoursPerWeek: 5 });
    expect(r.ok).toBe(true);
    expect(r.used).toBe('local');
    expect(r.path?.tasks.length).toBeGreaterThan(0);
  });

  it('falls back to local when remote fails', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }));
    const r = await buildByokPath(
      { text: 'Learn marketing', horizonMonths: 6, hoursPerWeek: 4 },
      { provider: 'gemini', key: 'bad', webSearch: true },
      fetchImpl as unknown as typeof fetch,
    );
    expect(r.ok).toBe(true);
    expect(r.used).toBe('local-fallback');
    expect(r.path?.goal).toContain('Learn marketing');
  });

  it('sends Gemini API key in header, never in the URL', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).not.toMatch(/[?&]key=/);
      expect(url).toContain('generativelanguage.googleapis.com');
      const headers = new Headers(init?.headers);
      expect(headers.get('x-goog-api-key')).toBe('secret-gemini');
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '{"steps":[{"title":"BOM","estimateMin":50}]}' }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const r = await buildByokPath(
      { text: 'Build a drone', horizonMonths: 6, hoursPerWeek: 5, kind: 'build' },
      { provider: 'gemini', key: 'secret-gemini', webSearch: false },
      fetchImpl as unknown as typeof fetch,
    );
    expect(r.ok).toBe(true);
    expect(r.used).toBe('gemini');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
