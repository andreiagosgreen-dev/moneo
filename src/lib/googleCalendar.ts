/**
 * Client-side wrappers for the Worker's `/api/calendar/*` endpoints
 * (Roadmap Faza 10). Same-origin `fetch()`, same idiom as
 * `authProvider.tsx`'s `requestAccountDeletion` — every call fails open to
 * a safe default on error, matching `fetchSubscription`'s existing pattern,
 * since a calendar hiccup must never block the core timer experience.
 */

export interface ExternalCalendarEvent {
  id: string;
  title: string;
  startsAt: number;
  endsAt: number;
  allDay: boolean;
}

export interface CalendarConnectionStatus {
  connected: boolean;
  googleEmail?: string;
  connectedAt?: string;
}

const NOT_CONNECTED: CalendarConnectionStatus = { connected: false };

export async function connectGoogleCalendar(
  accessToken: string,
  refreshToken: string,
  googleEmail?: string,
): Promise<boolean> {
  try {
    const res = await fetch('/api/calendar/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ refreshToken, googleEmail }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchCalendarStatus(accessToken: string): Promise<CalendarConnectionStatus> {
  try {
    const res = await fetch('/api/calendar/status', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return NOT_CONNECTED;
    return (await res.json()) as CalendarConnectionStatus;
  } catch {
    return NOT_CONNECTED;
  }
}

export type CalendarEventsResult =
  { ok: true; events: ExternalCalendarEvent[] } | { ok: false; reconnectRequired: boolean };

export async function fetchCalendarEvents(
  accessToken: string,
  rangeStartMs: number,
  rangeEndMs: number,
): Promise<CalendarEventsResult> {
  try {
    const params = new URLSearchParams({
      start: new Date(rangeStartMs).toISOString(),
      end: new Date(rangeEndMs).toISOString(),
    });
    const res = await fetch(`/api/calendar/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, reconnectRequired: res.status === 409 };
    const data = (await res.json()) as { events?: ExternalCalendarEvent[] };
    return { ok: true, events: Array.isArray(data.events) ? data.events : [] };
  } catch {
    return { ok: false, reconnectRequired: false };
  }
}

export async function disconnectGoogleCalendar(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch('/api/calendar/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
