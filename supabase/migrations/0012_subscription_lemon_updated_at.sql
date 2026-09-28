-- ============================================================
-- Moneo migration 0012: Lemon event ordering for subscriptions
--
-- Stores Lemon Squeezy `data.attributes.updated_at` of the last applied
-- subscription webhook. The Worker skips strictly older events so an
-- out-of-order delivery cannot roll a subscription back. Additive and
-- idempotent; the Worker tolerates the column being absent.
-- ============================================================

alter table public.subscriptions
  add column if not exists lemon_updated_at timestamptz null;
