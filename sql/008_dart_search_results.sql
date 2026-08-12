-- 모듈5: 활용 이력 분석 - DART/수동 검색 결과 저장 테이블
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists pgcrypto;

create table if not exists dart_search_results (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  source_name text not null,
  corp_name text,
  corp_code text,
  ceo_name text,
  biz_no text,
  address text,
  corp_cls text,
  status text not null default '대기중',
  search_type text not null default 'auto',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_dart_search_results_case on dart_search_results(case_id);

alter table dart_search_results enable row level security;

drop policy if exists "dart_search_results_allow_all" on dart_search_results;
create policy "dart_search_results_allow_all"
  on dart_search_results
  for all
  using (true)
  with check (true);
