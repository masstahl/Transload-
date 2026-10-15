-- Shared Transload Log database setup.
-- Anonymous sign-ins must be enabled in Supabase Authentication settings.

create extension if not exists pgcrypto;

create table if not exists public.outgoing_entries (
  id uuid primary key default gen_random_uuid(),
  location text not null check (location in ('Quincy','Pasco','Warden','Richland')),
  truck text not null,
  trailer text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  created_by_name text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  updated_by_name text not null
);

create table if not exists public.incoming_entries (
  id uuid primary key default gen_random_uuid(),
  truck text not null,
  field text not null,
  driver text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  created_by_name text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  updated_by_name text not null
);

create table if not exists public.quick_drivers (
  id uuid primary key default gen_random_uuid(),
  truck text not null unique,
  driver text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  updated_by_name text not null
);

alter table public.outgoing_entries enable row level security;
alter table public.incoming_entries enable row level security;
alter table public.quick_drivers enable row level security;

drop policy if exists "shared outgoing entries" on public.outgoing_entries;
create policy "shared outgoing entries" on public.outgoing_entries for all to authenticated using (true) with check (true);

drop policy if exists "shared incoming entries" on public.incoming_entries;
create policy "shared incoming entries" on public.incoming_entries for all to authenticated using (true) with check (true);

drop policy if exists "shared quick drivers" on public.quick_drivers;
create policy "shared quick drivers" on public.quick_drivers for all to authenticated using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table public.outgoing_entries;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.incoming_entries;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.quick_drivers;
exception when duplicate_object then null;
end $$;


create table if not exists public.arrival_plans (
  id uuid primary key default gen_random_uuid(),
  plan_date date not null unique,
  pasco integer not null default 0,
  warden integer not null default 0,
  quincy integer not null default 0,
  richland integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  updated_by_name text not null
);

create table if not exists public.potato_varieties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  created_by_name text not null
);

alter table public.outgoing_entries add column if not exists field text;
alter table public.outgoing_entries add column if not exists variety text;

alter table public.arrival_plans enable row level security;
alter table public.potato_varieties enable row level security;

drop policy if exists "shared arrival plans" on public.arrival_plans;
create policy "shared arrival plans" on public.arrival_plans for all to authenticated using (true) with check (true);

drop policy if exists "shared potato varieties" on public.potato_varieties;
create policy "shared potato varieties" on public.potato_varieties for all to authenticated using (true) with check (true);

do $$ begin alter publication supabase_realtime add table public.arrival_plans; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.potato_varieties; exception when duplicate_object then null; end $$;

-- ── 2026-10-15: time-in/time-out per load + plan revision history ──
-- Run this block in the Supabase SQL editor. Safe to re-run (all idempotent).

-- Optional per-load loading times. NULL = not recorded; the app treats
-- missing values as "operator didn't time this load" and hides the pill state.
alter table public.outgoing_entries add column if not exists load_started_at timestamptz;
alter table public.outgoing_entries add column if not exists load_finished_at timestamptz;

-- Every plant-need change, so the pace chart can score each load against the
-- plan that was in effect when it happened (plants change needs intraday).
create table if not exists public.plan_revisions (
  id uuid primary key default gen_random_uuid(),
  site_id integer not null,
  plan_date date not null,
  pasco integer not null default 0,
  warden integer not null default 0,
  quincy integer not null default 0,
  richland integer not null default 0,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  changed_by_name text not null
);
create index if not exists plan_revisions_site_date_idx
  on public.plan_revisions (site_id, plan_date, changed_at);

alter table public.plan_revisions enable row level security;
drop policy if exists "shared plan revisions" on public.plan_revisions;
create policy "shared plan revisions" on public.plan_revisions
  for all to authenticated using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table public.plan_revisions;
exception when duplicate_object then null;
end $$;
