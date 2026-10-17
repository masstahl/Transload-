-- Transload Log Web Push subscriptions and idempotent delivery tracking.
-- Source migration only: do not run against production until reviewed and approved.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error_at timestamptz
);
create index if not exists push_subscriptions_user_enabled_idx on public.push_subscriptions (user_id, enabled);
alter table public.push_subscriptions enable row level security;
drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions" on public.push_subscriptions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.push_notification_deliveries (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.outgoing_entries(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  notification_type text not null default 'load_overdue',
  status text not null default 'sending' check (status in ('sending','sent')),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  unique (entry_id, subscription_id, notification_type)
);
create index if not exists push_deliveries_claim_idx on public.push_notification_deliveries (status, claimed_at);
alter table public.push_notification_deliveries enable row level security;
-- No browser-facing policies: delivery state is server-only and accessed by service role.
