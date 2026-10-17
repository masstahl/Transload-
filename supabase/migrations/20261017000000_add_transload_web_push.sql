-- Additive schema for Transload Log Web Push alerts. Existing load records are untouched.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='push_subscriptions' and policyname='Users manage their own push subscriptions') then
    create policy "Users manage their own push subscriptions" on public.push_subscriptions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;
create table if not exists public.push_overdue_events (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.outgoing_entries(id) on delete cascade,
  load_started_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  deliveries integer not null default 0,
  unique (entry_id, load_started_at)
);
alter table public.push_overdue_events enable row level security;
revoke all on public.push_overdue_events from anon, authenticated;
