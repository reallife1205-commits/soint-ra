-- 모듈4: 항공사진 타임라인 AI 종합의견 저장 테이블
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists pgcrypto;

create table if not exists timeline_analyses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references cases(id) on delete cascade,
  content text,
  updated_at timestamptz not null default now()
);

alter table timeline_analyses enable row level security;

drop policy if exists "timeline_analyses_allow_all" on timeline_analyses;
create policy "timeline_analyses_allow_all"
  on timeline_analyses
  for all
  using (true)
  with check (true);
