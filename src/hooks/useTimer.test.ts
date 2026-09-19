import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { useTimer, type UseTimerOptions } from './useTimer';
import { DEFAULT_SETTINGS, type Session } from '../lib/store';

// Enables React 18 act() flushing outside RTL.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useTimer>;

function baseOptions(overrides?: Partial<UseTimerOptions>): UseTimerOptions {
  return {
    settings: { ...DEFAULT_SETTINGS, sound: false, notifications: false },
    setSettings: () => {},
    getContext: () => ({
      intentionDraft: '',
      selectedAreaId: null,
      areas: [],
      selectedProjectId: null,
      selectedTaskId: null,
    }),
    onSession: () => {},
    initial: {
      mode: 'focus',
      total: 1500,
      remaining: 1500,
      cycle: 0,
      roundMin: 25,
      roundIntention: null,
      roundAreaId: null,
      roundProjectId: null,
      roundTaskId: null,
    },
    ...overrides,
  };
}

function harness(opts?: Partial<UseTimerOptions>) {
  let api: Api | null = null;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  function Probe() {
    api = useTimer(baseOptions(opts));
    return null;
  }
  act(() => {
    root.render(createElement(Probe));
  });
  return {
    api: () => api as Api,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useTimer', () => {
  it('boots from the initial snapshot', () => {
    const h = harness();
    try {
      const api = h.api();
      expect(api.mode).toBe('focus');
      expect(api.total).toBe(1500);
      expect(api.remaining).toBe(1500);
      expect(api.running).toBe(false);
      expect(api.cycle).toBe(0);
    } finally {
      h.cleanup();
    }
  });

  it('starts and pauses, preserving the countdown', () => {
    const h = harness();
    try {
      act(() => {
        h.api().toggle();
      });
      expect(h.api().running).toBe(true);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      const mid = h.api().remaining;
      expect(mid).toBeLessThan(1500);
      act(() => {
        h.api().toggle();
      });
      expect(h.api().running).toBe(false);
      expect(h.api().remaining).toBe(mid);
    } finally {
      h.cleanup();
    }
  });

  it('records a completed session and advances the cycle', () => {
    const sessions: Session[] = [];
    const h = harness({
      onSession: (entry) => sessions.push(entry),
      initial: {
        mode: 'focus',
        total: 60,
        remaining: 2,
        cycle: 0,
        roundMin: 25,
        roundIntention: 'Ship it',
        roundAreaId: null,
        roundProjectId: null,
        roundTaskId: null,
      },
    });
    try {
      act(() => {
        h.api().toggle();
      });
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(h.api().running).toBe(false);
      expect(h.api().mode).toBe('short');
      expect(h.api().cycle).toBe(1);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].min).toBe(25);
      expect(sessions[0].intention).toBe('Ship it');
    } finally {
      h.cleanup();
    }
  });

  it('switches mode, resets and skips', () => {
    const h = harness();
    try {
      act(() => {
        h.api().switchMode('short');
      });
      expect(h.api().mode).toBe('short');
      expect(h.api().total).toBe(DEFAULT_SETTINGS.shortMin * 60);
      act(() => {
        h.api().toggle();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      act(() => {
        h.api().reset();
      });
      expect(h.api().running).toBe(false);
      expect(h.api().remaining).toBe(h.api().total);
      act(() => {
        h.api().skip();
      });
      // Skipping a break returns to focus.
      expect(h.api().mode).toBe('focus');
    } finally {
      h.cleanup();
    }
  });

  it('responds to Space (toggle) and R (reset) keys', () => {
    const h = harness();
    try {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      });
      expect(h.api().running).toBe(true);
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
      });
      expect(h.api().running).toBe(false);
    } finally {
      h.cleanup();
    }
  });
});
