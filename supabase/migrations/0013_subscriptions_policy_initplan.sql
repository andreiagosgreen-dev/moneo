-- ============================================================
-- Moneo migration 0013: re-wrap auth.uid() in subscriptions_select_own
--
-- Production had drifted back to `user_id = auth.uid()` on this policy,
-- so Supabase's performance advisor flagged auth_rls_initplan again.
-- Same fix as 0008: (select auth.uid()) is evaluated once per query via
-- an InitPlan. Semantics unchanged: SELECT-only, owner rows only,
-- default roles; writes stay server-side. Idempotent.
-- ============================================================

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = (select auth.uid()));
