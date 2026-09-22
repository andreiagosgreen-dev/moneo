-- ============================================================
-- Moneo migration 0009: focus buddy (Faza 25)
--
-- One accountability pairing per user, at most one buddy at a time.
-- No feed, no leaderboard, no history exposed — only "today's focused
-- minutes" is ever surfaced to a buddy, and only through the Worker
-- (service_role), never a direct client read.
--
-- Pairing flow: user A creates a pending row with a random invite code
-- (shared out of band, e.g. copy/paste); user B "claims" it by posting
-- the code, which fills in user_b and flips status to 'accepted'.
--
-- RLS: deliberately ZERO policies (not even owner SELECT) — stricter
-- than `subscriptions`, matching the `google_calendar_connections`
-- precedent from Faza 10. Only service_role (bypasses RLS), only from
-- the Worker, may touch this table.
-- ============================================================

create table if not exists public.focus_buddy_pairs (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references auth.users (id) on delete cascade,
  user_b       uuid null references auth.users (id) on delete cascade,
  invite_code  text not null unique,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz null,
  -- A user may only be in one pairing at a time, on either side.
  constraint focus_buddy_pairs_distinct_users check (user_a is distinct from user_b)
);

create unique index if not exists focus_buddy_pairs_user_a_unique
  on public.focus_buddy_pairs (user_a);

create unique index if not exists focus_buddy_pairs_user_b_unique
  on public.focus_buddy_pairs (user_b) where user_b is not null;

create index if not exists focus_buddy_pairs_invite_code_idx
  on public.focus_buddy_pairs (invite_code) where status = 'pending';

alter table public.focus_buddy_pairs enable row level security;
-- No policies — service_role only, from the Worker (see cloudflare/workers/focusBuddy.ts).
