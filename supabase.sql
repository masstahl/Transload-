-- Run this once in the Supabase project's SQL Editor before publishing the app.
-- Authentication > Providers: enable Anonymous sign-ins in the Supabase dashboard.
create extension if not exists pgcrypto;

create table if not exists public.outgoing_loads (
  id uuid primary key default gen_random_uuid(),
  location text not null check (location in ('Quincy','Pasco','Warden','Richland')),
  truck text not null,
  trailer text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  created_by_name text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  updated_by_name text not null
);

create table if not exists public.incoming_entries (
  id uuid primary key default gen_random_uuid(),
  truck text not null,
  driver text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  created_by_name text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  updated_by_name text not null
);

create table if not exists public.quick_drivers (
  id uuid primary key default gen_random_uuid(),
  truck text not null unique,
  driver text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  updated_by_name text not null
);

alter table public.outgoing_loads enable row level security;
alter table public.incoming_entries enable row level security;
alter table public.quick_drivers enable row level security;

-- Any signed-in operator may see and maintain the shared operations log.
drop policy if exists "shared outgoing log" on public.outgoing_loads;
create policy "shared outgoing log" on public.outgoing_loads for all to authenticated using (true) with check (true);
drop policy if exists "shared incoming log" on public.incoming_entries;
create policy "shared incoming log" on public.incoming_entries for all to authenticated using (true) with check (true);
drop policy if exists "shared quick drivers" on public.quick_drivers;
create policy "shared quick drivers" on public.quick_drivers for all to authenticated using (true) with check (true);

-- Realtime delivers other operators' changes without a manual refresh.
alter publication supabase_realtime add table public.outgoing_loads;
alter publication supabase_realtime add table public.incoming_entries;
alter publication supabase_realtime add table public.quick_drivers;
