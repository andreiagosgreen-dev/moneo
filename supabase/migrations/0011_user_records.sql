-- ============================================================
-- Moneo migration 0011: Pro full-data sync (user_records)
--
-- One row per user-created planning record (a project, a task, one
-- journal day, one habit's log, ...), stored as an opaque JSON document
-- keyed by (user_id, collection, record_id). Focus sessions, focus areas
-- and settings keep their dedicated tables (0001) and sync for every
-- signed-in user; user_records is the Pro-only layer on top.
--
-- Conflict model: last-write-wins per record on `updated_at` (client
-- epoch-ms of the edit). Deletions are tombstones (`deleted = true`,
-- `data = null`) so they propagate to other devices.
-- `server_updated_at` is the server's own clock, used only as the
-- incremental-pull cursor.
--
-- Access:
--   * SELECT: owner only (RLS) — also after Pro lapses, so a user can
--     always read/export what is already in their account.
--   * INSERT/UPDATE/DELETE: no client policy at all. Writes go through
--     the Worker (`/api/sync/records`), which verifies the JWT, checks
--     Pro server-side (paid or complimentary) and calls
--     upsert_user_records() with the service role.
--   * Account deletion wipes the rows (Worker) and the FK cascades.
-- ============================================================

create table if not exists public.user_records (
  user_id            uuid not null references auth.users (id) on delete cascade,
  collection         text not null,
  record_id          text not null,
  data               jsonb null,
  deleted            boolean not null default false,
  updated_at         bigint not null,
  server_updated_at  timestamptz not null default clock_timestamp(),
  primary key (user_id, collection, record_id),
  constraint user_records_collection_check
    check (collection ~ '^[a-z][a-z0-9_]{0,39}$'),
  constraint user_records_record_id_check
    check (char_length(record_id) between 1 and 200),
  constraint user_records_updated_at_check
    check (updated_at >= 0),
  constraint user_records_tombstone_check
    check ((deleted and data is null) or (not deleted and data is not null)),
  constraint user_records_data_size_check
    check (data is null or pg_column_size(data) <= 262144)
);

create index if not exists user_records_user_server_updated_idx
  on public.user_records (user_id, server_updated_at);

alter table public.user_records enable row level security;

drop policy if exists user_records_select_own on public.user_records;
create policy user_records_select_own on public.user_records
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Batch upsert with server-side last-write-wins: an incoming record only
-- replaces the stored one when its updated_at is strictly newer, so a
-- stale device can never overwrite a newer edit. Returns rows written.
create or replace function public.upsert_user_records(p_user_id uuid, p_records jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  written integer;
begin
  if p_user_id is null or jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'invalid arguments';
  end if;

  insert into public.user_records as ur
    (user_id, collection, record_id, data, deleted, updated_at, server_updated_at)
  select
    p_user_id,
    r ->> 'collection',
    r ->> 'record_id',
    case when coalesce((r ->> 'deleted')::boolean, false) then null else r -> 'data' end,
    coalesce((r ->> 'deleted')::boolean, false),
    (r ->> 'updated_at')::bigint,
    clock_timestamp()
  from jsonb_array_elements(p_records) as r
  on conflict (user_id, collection, record_id) do update
    set data = excluded.data,
        deleted = excluded.deleted,
        updated_at = excluded.updated_at,
        server_updated_at = clock_timestamp()
    where excluded.updated_at > ur.updated_at;

  get diagnostics written = row_count;
  return written;
end;
$$;

revoke all on function public.upsert_user_records(uuid, jsonb) from public;
revoke all on function public.upsert_user_records(uuid, jsonb) from anon;
revoke all on function public.upsert_user_records(uuid, jsonb) from authenticated;
grant execute on function public.upsert_user_records(uuid, jsonb) to service_role;
