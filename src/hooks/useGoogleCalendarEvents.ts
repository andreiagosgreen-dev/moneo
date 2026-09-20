import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { currentWeekKeys } from '../lib/timeBlocks';
import { fetchCalendarEvents, type ExternalCalendarEvent } from '../lib/googleCalendar';

/**
 * Fetches the current week's real Google Calendar events for conflict
 * display (Roadmap Faza 10). Mirrors `useDeadlineReminders`'s shape: a
 * single effect gated on `isPro`, refetching when the visible week or
 * timezone changes. Fails silently to an empty list — a calendar hiccup
 * must never block the core timer experience.
 */
export function useGoogleCalendarEvents(isPro: boolean, timezone: string): ExternalCalendarEvent[] {
  const [events, setEvents] = useState<ExternalCalendarEvent[]>([]);
  const weekStartKey = currentWeekKeys(timezone)[0];

  useEffect(() => {
    if (!isPro) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const client = await getSupabaseClient();
      if (!client) return;
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const keys = currentWeekKeys(timezone);
      const [sy, sm, sd] = keys[0].split('-').map(Number);
      const [ey, em, ed] = keys[keys.length - 1].split('-').map(Number);
      const rangeStart = new Date(sy, sm - 1, sd).getTime();
      const rangeEnd = new Date(ey, em - 1, ed + 1).getTime();
      const result = await fetchCalendarEvents(token, rangeStart, rangeEnd);
      if (!cancelled && result.ok) setEvents(result.events);
    })();
    return () => {
      cancelled = true;
    };
  }, [isPro, timezone, weekStartKey]);

  return events;
}
