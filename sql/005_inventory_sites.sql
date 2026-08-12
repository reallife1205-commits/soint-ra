-- 토양 인벤토리(부지 목록 관리) 테이블
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists pgcrypto;

create table if not exists inventory_sites (
  id uuid primary key default gen_random_uuid(),
  site_name text not null,
  address text,
  lat double precision,
  lon double precision,
  area_sqm numeric,
  land_use text,
  land_use_history text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_sites_created_at on inventory_sites(created_at desc);

alter table inventory_sites enable row level security;

drop policy if exists "inventory_sites_allow_all" on inventory_sites;
create policy "inventory_sites_allow_all"
  on inventory_sites
  for all
  using (true)
  with check (true);
