-- ============================================================
-- Moneo core schema (Gate 8, recovered at Gate 13)
--
-- Tables: profiles, focus_sessions, focus_areas, user_settings
-- RLS enabled on ALL user-data tables. Ownership via auth.uid().
-- No `using (true)`. No anonymous access. No blanket policies.
--
-- FK semantics: deleting an area SET NULLs session.area_id —
-- historical focus minutes are NEVER deleted with an area.
-- ============================================================

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  timezone   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.focus_areas (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.focus_sessions (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  completed_at timestamptz not null,
  duration_min integer not null check (duration_min > 0),
  intention    text null check (char_length(intention) <= 80),
  area_id      uuid null references public.focus_areas (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  focus_min  integer not null check (focus_min between 1 and 120),
  short_min  integer not null check (short_min between 1 and 60),
  long_min   integer not null check (long_min between 1 and 90),
  long_every integer not null check (long_every between 2 and 8),
  daily_goal integer not null check (daily_goal between 1 and 20),
  auto_start boolean not null default false,
  sound      boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------- indexes for actual repository query patterns ----------

create index if not exists focus_sessions_user_completed_idx
  on public.focus_sessions (user_id, completed_at desc);

create index if not exists focus_areas_user_updated_idx
  on public.focus_areas (user_id, updated_at);

-- ---------- row level security ----------

alter table public.profiles       enable row level security;
alter table public.focus_areas    enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.user_settings  enable row level security;

-- profiles: own record only
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (user_id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- focus_sessions: own rows only
drop policy if exists "sessions_select_own" on public.focus_sessions;
create policy "sessions_select_own" on public.focus_sessions
  for select using (user_id = auth.uid());

drop policy if exists "sessions_insert_own" on public.focus_sessions;
create policy "sessions_insert_own" on public.focus_sessions
  for insert with check (user_id = auth.uid());

drop policy if exists "sessions_update_own" on public.focus_sessions;
create policy "sessions_update_own" on public.focus_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "sessions_delete_own" on public.focus_sessions;
create policy "sessions_delete_own" on public.focus_sessions
  for delete using (user_id = auth.uid());

-- focus_areas: own rows only
drop policy if exists "areas_select_own" on public.focus_areas;
create policy "areas_select_own" on public.focus_areas
  for select using (user_id = auth.uid());

drop policy if exists "areas_insert_own" on public.focus_areas;
create policy "areas_insert_own" on public.focus_areas
  for insert with check (user_id = auth.uid());

drop policy if exists "areas_update_own" on public.focus_areas;
create policy "areas_update_own" on public.focus_areas
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "areas_delete_own" on public.focus_areas;
create policy "areas_delete_own" on public.focus_areas
  for delete using (user_id = auth.uid());

-- user_settings: own record only
drop policy if exists "settings_select_own" on public.user_settings;
create policy "settings_select_own" on public.user_settings
  for select using (user_id = auth.uid());

drop policy if exists "settings_insert_own" on public.user_settings;
create policy "settings_insert_own" on public.user_settings
  for insert with check (user_id = auth.uid());

drop policy if exists "settings_update_own" on public.user_settings;
create policy "settings_update_own" on public.user_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
