-- 모듈7: 오염물질 x 기업 연관성 매트릭스 저장 테이블
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists pgcrypto;

create table if not exists pollution_mappings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  substance text not null,
  company_name text not null,
  level text not null default '판단불가',
  note text,
  updated_at timestamptz not null default now(),
  unique (case_id, substance, company_name)
);

create index if not exists idx_pollution_mappings_case on pollution_mappings(case_id);

alter table pollution_mappings enable row level security;

drop policy if exists "pollution_mappings_allow_all" on pollution_mappings;
create policy "pollution_mappings_allow_all"
  on pollution_mappings
  for all
  using (true)
  with check (true);
