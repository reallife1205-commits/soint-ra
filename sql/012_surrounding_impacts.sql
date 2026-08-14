-- 모듈7: 주변부지 오염 영향 판단 저장 테이블
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists pgcrypto;

create table if not exists surrounding_impacts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  substance text not null,
  target_max numeric,
  surrounding_max numeric,
  ratio numeric,
  verdict text not null default '판단불가',
  note text,
  updated_at timestamptz not null default now(),
  unique (case_id, substance)
);

create index if not exists idx_surrounding_impacts_case on surrounding_impacts(case_id);

alter table surrounding_impacts enable row level security;

drop policy if exists "surrounding_impacts_allow_all" on surrounding_impacts;
create policy "surrounding_impacts_allow_all"
  on surrounding_impacts
  for all
  using (true)
  with check (true);
