-- ============================================================
-- Moneo migration 0008: stop re-evaluating auth.uid() per row
--
-- Every owner-scoped RLS policy compared user_id = auth.uid() directly,
-- which Postgres re-runs the function call for every row scanned. The
-- fix is purely a query-plan optimization, not a semantics change:
-- wrapping the call as (select auth.uid()) lets Postgres evaluate it
-- once per query via an InitPlan instead. Same access rules, same
-- owner-only scope, faster at scale. Flagged by Supabase's performance
-- advisor (auth_rls_initplan) across profiles, focus_sessions,
-- focus_areas, user_settings and subscriptions. Idempotent (each
-- policy is dropped and recreated with the same name/command/roles).
-- ============================================================

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (user_id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (user_id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- focus_sessions
drop policy if exists sessions_select_own on public.focus_sessions;
create policy sessions_select_own on public.focus_sessions
  for select using (user_id = (select auth.uid()));

drop policy if exists sessions_insert_own on public.focus_sessions;
create policy sessions_insert_own on public.focus_sessions
  for insert with check (user_id = (select auth.uid()));

drop policy if exists sessions_update_own on public.focus_sessions;
create policy sessions_update_own on public.focus_sessions
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists sessions_delete_own on public.focus_sessions;
create policy sessions_delete_own on public.focus_sessions
  for delete using (user_id = (select auth.uid()));

-- focus_areas
drop policy if exists areas_select_own on public.focus_areas;
create policy areas_select_own on public.focus_areas
  for select using (user_id = (select auth.uid()));

drop policy if exists areas_insert_own on public.focus_areas;
create policy areas_insert_own on public.focus_areas
  for insert with check (user_id = (select auth.uid()));

drop policy if exists areas_update_own on public.focus_areas;
create policy areas_update_own on public.focus_areas
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists areas_delete_own on public.focus_areas;
create policy areas_delete_own on public.focus_areas
  for delete using (user_id = (select auth.uid()));

-- user_settings
drop policy if exists settings_select_own on public.user_settings;
create policy settings_select_own on public.user_settings
  for select using (user_id = (select auth.uid()));

drop policy if exists settings_insert_own on public.user_settings;
create policy settings_insert_own on public.user_settings
  for insert with check (user_id = (select auth.uid()));

drop policy if exists settings_update_own on public.user_settings;
create policy settings_update_own on public.user_settings
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- subscriptions (SELECT-only for clients; writes stay server-side)
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = (select auth.uid()));
