-- ============================================================
-- Moneo migration 0009: Google Calendar read-only connection
--
-- Stores the refresh token needed to fetch a user's Google Calendar
-- events server-side (read-only conflict detection against time blocks,
-- Faza 10). This is a deliberate, narrow exception to Moneo's local-first
-- "nothing to leak server-side" default (see SECURITY.md) — a live Google
-- refresh token grants ongoing third-party account access, a stricter bar
-- than anything else this app stores.
--
-- RLS: deliberately NO policies at all, not even owner SELECT — stricter
-- than `subscriptions` (0004/0008), which allows the owner to read their
-- own row. Only service_role (bypasses RLS by default) may touch this
-- table, exclusively from the Worker (cloudflare/workers/calendar.ts).
-- The client never reads this table directly; connection status is
-- served through an authenticated Worker endpoint instead.
-- ============================================================

create table if not exists public.google_calendar_connections (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  google_email  text null,
  scope         text not null default 'https://www.googleapis.com/auth/calendar.events.readonly',
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.google_calendar_connections enable row level security;
