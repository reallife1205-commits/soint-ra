-- 모듈5: 공장등록 조회 결과 저장 테이블
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists pgcrypto;

create table if not exists factory_search_results (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  source_name text not null,
  fctry_manage_no text,
  cmpny_nm text,
  road_address text,
  rprsntv_nm text,
  org_nm text,
  tel_no text,
  land_area text,
  building_area text,
  use_area text,
  status text not null default '대기중',
  search_type text not null default 'auto',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_factory_search_results_case on factory_search_results(case_id);

alter table factory_search_results enable row level security;

drop policy if exists "factory_search_results_allow_all" on factory_search_results;
create policy "factory_search_results_allow_all"
  on factory_search_results
  for all
  using (true)
  with check (true);
