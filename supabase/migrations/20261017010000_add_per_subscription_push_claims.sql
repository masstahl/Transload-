-- Per-device delivery claims allow failed subscriptions to retry without duplicating successful deliveries.
create table if not exists public.push_overdue_deliveries (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.outgoing_entries(id) on delete cascade,
  load_started_at timestamptz not null,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (entry_id, load_started_at, subscription_id)
);
alter table public.push_overdue_deliveries enable row level security;
revoke all on public.push_overdue_deliveries from anon, authenticated;
