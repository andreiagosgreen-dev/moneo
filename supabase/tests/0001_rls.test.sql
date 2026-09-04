-- ============================================================
-- Moneo RLS / constraint tests (Gate 8, recovered at Gate 13)
--
-- STATUS: AUTHORED BUT NOT EXECUTED.
-- This sandbox has no local Supabase/Postgres toolchain, so these
-- were written against the Supabase CLI test conventions (pgTAP +
-- the tests.* helpers) but have NOT been run. They must be executed
-- via `supabase db test` before RLS is considered verified.
--
-- What is covered conceptually:
--   * ownership isolation (A reads A, not B; no cross-user writes)
--   * insert/update/delete restricted to own rows
--   * intention length (<= 80) and area name length (<= 40)
--   * duration_min > 0
--   * FK delete semantics: deleting an area NULLs session.area_id
--     and never deletes the session
-- ============================================================

begin;
select plan(14);

-- ---------- fixtures ----------
select tests.create_supabase_user('alice@example.com');
select tests.create_supabase_user('bob@example.com');

-- ---------- alice writes her own rows ----------
select tests.authenticate_as('alice@example.com');

select lives_ok(
  $$ insert into public.profiles (user_id, timezone)
     values (tests.get_authenticated_user_id(), 'Europe/Chisinau') $$,
  'alice can insert her own profile'
);

select lives_ok(
  $$ insert into public.focus_areas (id, user_id, name)
     values ('11111111-1111-1111-1111-111111111111',
             tests.get_authenticated_user_id(), 'Thesis') $$,
  'alice can insert her own area'
);

select lives_ok(
  $$ insert into public.focus_sessions
       (id, user_id, completed_at, duration_min, intention, area_id)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             tests.get_authenticated_user_id(), now(), 25, 'Write chapter 2',
             '11111111-1111-1111-1111-111111111111') $$,
  'alice can insert her own session'
);

-- ---------- constraints ----------
select throws_ok(
  $$ insert into public.focus_sessions
       (user_id, completed_at, duration_min, intention)
     values (tests.get_authenticated_user_id(), now(), 25,
             repeat('x', 81)) $$,
  null, null,
  'intention longer than 80 characters is rejected'
);

select throws_ok(
  $$ insert into public.focus_sessions
       (user_id, completed_at, duration_min)
     values (tests.get_authenticated_user_id(), now(), 0) $$,
  null, null,
  'duration_min must be > 0'
);

select throws_ok(
  $$ insert into public.focus_areas (user_id, name)
     values (tests.get_authenticated_user_id(), repeat('x', 41)) $$,
  null, null,
  'area name longer than 40 characters is rejected'
);

-- ---------- bob cannot touch alice's rows ----------
select tests.authenticate_as('bob@example.com');

select is_empty(
  $$ select 1 from public.focus_sessions
     where user_id <> tests.get_authenticated_user_id() $$,
  'bob cannot read alice''s sessions'
);

select throws_ok(
  $$ update public.focus_sessions set duration_min = 1
     where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  null, null,
  'bob cannot update alice''s session'
);

select throws_ok(
  $$ delete from public.focus_sessions
     where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  null, null,
  'bob cannot delete alice''s session'
);

select throws_ok(
  $$ insert into public.focus_sessions
       (user_id, completed_at, duration_min)
     values ((select user_id from public.profiles
              where timezone = 'Europe/Chisinau'), now(), 25) $$,
  null, null,
  'bob cannot insert a session owned by alice'
);

-- ---------- FK delete semantics ----------
select tests.authenticate_as('alice@example.com');

select lives_ok(
  $$ delete from public.focus_areas
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'alice can delete her own area'
);

select is_empty(
  $$ select 1 from public.focus_sessions
     where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and area_id is not null $$,
  'session.area_id is nulled, not deleted, after area deletion'
);

select isnt_empty(
  $$ select 1 from public.focus_sessions
     where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'the historical session itself survives area deletion'
);

select * from finish();
rollback;
