import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  fetchCalendarEvents,
  fetchCalendarStatus,
} from './googleCalendar';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCalendarStatus', () => {
  it('fails open to not-connected on a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down');
      }),
    );
    await expect(fetchCalendarStatus('token')).resolves.toEqual({ connected: false });
  });

  it('fails open to not-connected on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    );
    await expect(fetchCalendarStatus('token')).resolves.toEqual({ connected: false });
  });

  it('returns the parsed status on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ connected: true, googleEmail: 'a@b.com' }))),
    );
    await expect(fetchCalendarStatus('token')).resolves.toEqual({
      connected: true,
      googleEmail: 'a@b.com',
    });
  });
});

describe('fetchCalendarEvents', () => {
  it('fails open to an empty, non-reconnect result on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down');
      }),
    );
    await expect(fetchCalendarEvents('token', 0, 1)).resolves.toEqual({
      ok: false,
      reconnectRequired: false,
    });
  });

  it('flags reconnectRequired on a 409', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 409 })),
    );
    await expect(fetchCalendarEvents('token', 0, 1)).resolves.toEqual({
      ok: false,
      reconnectRequired: true,
    });
  });

  it('returns the mapped events on success', async () => {
    const events = [{ id: '1', title: 'Standup', startsAt: 0, endsAt: 1, allDay: false }];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ events }))),
    );
    await expect(fetchCalendarEvents('token', 0, 1)).resolves.toEqual({ ok: true, events });
  });
});

describe('connectGoogleCalendar / disconnectGoogleCalendar', () => {
  it('resolve false on failure, true on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    );
    await expect(connectGoogleCalendar('t', 'rt')).resolves.toBe(false);
    await expect(disconnectGoogleCalendar('t')).resolves.toBe(false);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    );
    await expect(connectGoogleCalendar('t', 'rt')).resolves.toBe(true);
    await expect(disconnectGoogleCalendar('t')).resolves.toBe(true);
  });
});
