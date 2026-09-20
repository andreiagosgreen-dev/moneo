-- ============================================================
-- Moneo migration 0007: stop exposing rls_auto_enable() as a public RPC
--
-- rls_auto_enable() is an event-trigger function (RETURNS event_trigger)
-- that auto-enables RLS on every new table created in public — a
-- belt-and-suspenders safety net, not something anyone should call
-- directly. Postgres already refuses direct invocation of
-- event-trigger-returning functions outside the trigger mechanism, so
-- this was never actually exploitable — but living in the public
-- schema with default privileges, it was auto-exposed by PostgREST as
-- /rest/v1/rpc/rls_auto_enable, callable by anon and authenticated
-- (flagged by Supabase's security advisor). Revoking EXECUTE removes
-- that RPC endpoint and the advisor noise without touching how the
-- event trigger itself fires. Idempotent.
-- ============================================================

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
