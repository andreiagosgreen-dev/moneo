-- ============================================================
-- Moneo migration 0004: subscriptions and billing
--
-- Stores Lemon Squeezy subscription state per user.
-- RLS: user can view their own subscription row.
-- Service role / backend updates subscription status.
-- ============================================================

create table if not exists public.subscriptions (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  lemon_customer_id     text null,
  lemon_subscription_id text null,
  status                text not null default 'free',
  plan_id               text not null default 'free',
  current_period_end    timestamptz null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (user_id = auth.uid());
