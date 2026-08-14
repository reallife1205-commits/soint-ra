-- 모듈7: 종합 검토 의견 저장 테이블
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists pgcrypto;

create table if not exists review_opinions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references cases(id) on delete cascade,
  content text,
  updated_at timestamptz not null default now()
);

alter table review_opinions enable row level security;

drop policy if exists "review_opinions_allow_all" on review_opinions;
create policy "review_opinions_allow_all"
  on review_opinions
  for all
  using (true)
  with check (true);
