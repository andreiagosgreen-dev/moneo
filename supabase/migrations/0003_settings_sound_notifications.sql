-- ============================================================
-- Moneo migration 0003: sound and notification preferences
--
-- Adds sound_type, volume and notifications columns to user_settings.
-- Defaults match client DEFAULT_SETTINGS.
-- ============================================================

alter table public.user_settings
  add column if not exists sound_type text not null default 'bell',
  add column if not exists volume integer not null default 50 check (volume between 0 and 100),
  add column if not exists notifications boolean not null default true;
