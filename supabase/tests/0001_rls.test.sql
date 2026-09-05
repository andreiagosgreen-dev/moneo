-- Moneo core RLS / constraint tests (pgTAP / Supabase CLI).
-- Run with `supabase db test` against a disposable local Supabase database.
-- The PGlite equivalent lives in src/lib/sync/schemaRls.integration.test.ts.
-- Every negative fixture is otherwise valid, isolating its intended policy
-- or constraint instead of failing because a required identifier is absent.

begin;
select plan(14);

select tests.create_supabase_user('alice@example.com');
select tests.create_supabase_user('bob@example.com');

select tests.authenticate_as('alice@example.com');
select set_config('moneo.alice_id', tests.get_authenticated_user_id()::text, false);

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
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
             tests.get_authenticated_user_id(), now(), 25, 'Write chapter 2',
             '11111111-1111-1111-1111-111111111111') $$,
  'alice can insert her own session'
);

-- Valid fixtures isolate the intended check constraints.
select throws_ok(
  $$ insert into public.focus_sessions
       (id, user_id, completed_at, duration_min, intention)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
             tests.get_authenticated_user_id(), now(), 25, repeat('x', 81)) $$,
  '23514', null,
  'intention longer than 80 characters is rejected by its check constraint'
);
select throws_ok(
  $$ insert into public.focus_sessions
       (id, user_id, completed_at, duration_min)
     values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
             tests.get_authenticated_user_id(), now(), 0) $$,
  '23514', null,
  'duration_min must be greater than zero'
);
select throws_ok(
  $$ insert into public.focus_areas (id, user_id, name)
     values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
             tests.get_authenticated_user_id(), repeat('x', 41)) $$,
  '23514', null,
  'area name longer than 40 characters is rejected by its check constraint'
);

select tests.authenticate_as('bob@example.com');
select is_empty(
  $$ select 1 from public.profiles
     where user_id = current_setting('moneo.alice_id')::uuid $$,
  'bob cannot read alice''s profile'
);
select is_empty(
  $$ select 1 from public.focus_sessions
     where user_id = current_setting('moneo.alice_id')::uuid $$,
  'bob cannot read alice''s sessions'
);
select is_empty(
  $$ with changed as (
       update public.focus_sessions set duration_min = 1
       where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       returning *
     ) select 1 from changed $$,
  'bob cannot update alice''s session'
);
select is_empty(
  $$ with removed as (
       delete from public.focus_sessions
       where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       returning *
     ) select 1 from removed $$,
  'bob cannot delete alice''s session'
);
select throws_ok(
  $$ insert into public.focus_sessions
       (id, user_id, completed_at, duration_min)
     values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
             current_setting('moneo.alice_id')::uuid, now(), 25) $$,
  '42501', null,
  'bob cannot insert a session owned by alice because RLS rejects the valid row'
);

select tests.authenticate_as('alice@example.com');
select lives_ok(
  $$ delete from public.focus_areas
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'alice can delete her own area'
);
select is_empty(
  $$ select 1 from public.focus_sessions
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and area_id is not null $$,
  'session.area_id is nulled, not deleted, after area deletion'
);
select isnt_empty(
  $$ select 1 from public.focus_sessions
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  'the historical session itself survives area deletion'
);

select * from finish();
rollback;
