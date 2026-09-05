-- R4A: retain every existing UUID; scope area identity to its owner.
-- Requires PostgreSQL 15+ for ON DELETE SET NULL (area_id).
-- Deploy this migration before the client using onConflict: "user_id,id".
-- No data rewrite: invalid legacy cross-owner references abort the migration
-- during FK validation, leaving the old schema intact for explicit repair.
begin;

alter table public.focus_sessions
  drop constraint focus_sessions_area_id_fkey;

alter table public.focus_areas
  drop constraint focus_areas_pkey,
  add constraint focus_areas_pkey primary key (user_id, id);

alter table public.focus_sessions
  add constraint focus_sessions_user_area_fkey
  foreign key (user_id, area_id)
  references public.focus_areas (user_id, id)
  on delete set null (area_id);

-- Index the referencing columns for scoped lookup and area deletion.
create index focus_sessions_user_area_idx
  on public.focus_sessions (user_id, area_id);

-- Existing auth.uid() ownership policies and auth.users cascades are retained.
commit;
