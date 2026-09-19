-- ============================================================
-- Moneo migration 0005: weekly capacity for allocation insights
--
-- Adds weekly_capacity_min to user_settings (mirrors the local
-- Settings.weeklyCapacityMin, default 25h). Idempotent.
-- ============================================================

alter table public.user_settings
  add column if not exists weekly_capacity_min integer not null default 1500
    check (weekly_capacity_min between 60 and 10080);
