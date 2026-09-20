-- ============================================================
-- Moneo migration 0006: backend CHECK validation for billing
--
-- The webhook is the only writer of subscriptions.status / plan_id
-- (clients hold SELECT-only RLS). Constrain both columns so a
-- compromised or buggy writer fails loudly instead of storing
-- values the client can misread as a plan change. Idempotent.
-- ============================================================

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('free', 'active', 'past_due', 'cancelled', 'expired', 'paused', 'unpaid'));

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan_id in ('free', 'pro-monthly', 'pro-yearly'));
