-- R4A executable SQL assertions; no pgTAP/test-helper extension required.
-- Run as an administrator against a disposable database after 0001 + 0002.
-- Tests switch to a non-owner, non-BYPASSRLS role for ownership checks.
-- Every fixture and mutation is rolled back. Never run against production.
begin;

create function pg_temp.assert_true(value boolean, message text) returns void
language plpgsql as $$ begin
  if value is distinct from true then raise exception 'R4A: %', message; end if;
end $$;

insert into auth.users(id) values
  ('55555555-5555-4555-8555-555555555555'),
  ('66666666-6666-4666-8666-666666666666');

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);

insert into public.focus_areas(user_id,id,name) values
  (auth.uid(),'a1100000-0000-4000-8000-000000000001','Work'),
  (auth.uid(),'a1100000-0000-4000-8000-000000000002','Study'),
  (auth.uid(),'a1100000-0000-4000-8000-000000000003','Personal'),
  (auth.uid(),'77777777-7777-4777-8777-777777777777','A only');
-- A second device uses the same scoped conflict target and the same Work row.
insert into public.focus_areas(user_id,id,name) values
  (auth.uid(),'a1100000-0000-4000-8000-000000000001','Work')
on conflict (user_id,id) do update set name=excluded.name;
select pg_temp.assert_true((select count(*)=1 from public.focus_areas
  where id='a1100000-0000-4000-8000-000000000001'), 'same-user Work converges');

insert into public.focus_sessions(id,user_id,completed_at,duration_min,area_id)
values ('88888888-8888-4888-8888-888888888888',auth.uid(),now(),25,
  'a1100000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select pg_temp.assert_true((select count(*)=0 from public.focus_areas), 'B cannot read A areas');
select pg_temp.assert_true((select count(*)=0 from public.focus_sessions), 'B cannot read A sessions');

insert into public.focus_areas(user_id,id,name) values
  (auth.uid(),'a1100000-0000-4000-8000-000000000001','Work'),
  (auth.uid(),'a1100000-0000-4000-8000-000000000002','Study'),
  (auth.uid(),'a1100000-0000-4000-8000-000000000003','Personal');
select pg_temp.assert_true((select count(*)=3 from public.focus_areas), 'B owns independent defaults');
insert into public.focus_sessions(id,user_id,completed_at,duration_min,area_id)
values ('99999999-9999-4999-8999-999999999999',auth.uid(),now(),50,
  'a1100000-0000-4000-8000-000000000001');

do $$ begin
  begin
    insert into public.focus_sessions(id,user_id,completed_at,duration_min,area_id)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth.uid(),now(),25,
      '77777777-7777-4777-8777-777777777777');
    raise exception 'R4A: cross-owner FK was accepted';
  exception when foreign_key_violation then null; end;
  begin
    update public.focus_sessions set area_id='77777777-7777-4777-8777-777777777777'
      where id='99999999-9999-4999-8999-999999999999';
    raise exception 'R4A: cross-owner FK update was accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.focus_areas(user_id,id,name) values
      ('55555555-5555-4555-8555-555555555555','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Spoof');
    raise exception 'R4A: cross-owner insert was accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.focus_areas set user_id='55555555-5555-4555-8555-555555555555'
      where id='a1100000-0000-4000-8000-000000000003';
    raise exception 'R4A: owner transfer was accepted';
  exception when insufficient_privilege then null; end;
end $$;

with changed as (update public.focus_areas set name='Spoof'
  where user_id='55555555-5555-4555-8555-555555555555' returning *)
select pg_temp.assert_true((select count(*)=0 from changed), 'cross-user update affects no areas');
with removed as (delete from public.focus_areas
  where user_id='55555555-5555-4555-8555-555555555555' returning *)
select pg_temp.assert_true((select count(*)=0 from removed), 'cross-user delete affects no areas');

-- Deleting B's Work nulls only B's session FK, never its owner or history.
delete from public.focus_areas where id='a1100000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select area_id is null and user_id=auth.uid() and duration_min=50
  from public.focus_sessions where id='99999999-9999-4999-8999-999999999999'),
  'hard delete preserves B session and owner');

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select pg_temp.assert_true((select area_id='a1100000-0000-4000-8000-000000000001' and duration_min=25
  from public.focus_sessions where id='88888888-8888-4888-8888-888888888888'),
  'deleting B Work leaves A session reference intact');

reset role;
select pg_temp.assert_true((select count(*)=2 from public.focus_areas
  where id='a1100000-0000-4000-8000-000000000002'), 'same UUID exists under two owners');
select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.focus_areas'::regclass,'public.focus_sessions'::regclass)),
  'RLS remains enabled');

rollback;
