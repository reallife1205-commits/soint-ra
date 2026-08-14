-- 모듈6: 현장 및 청취조사 저장 테이블
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists pgcrypto;

create table if not exists field_surveys (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references cases(id) on delete cascade,
  survey_date date,
  field_items jsonb,
  interview_items jsonb,
  updated_at timestamptz not null default now()
);

alter table field_surveys enable row level security;

drop policy if exists "field_surveys_allow_all" on field_surveys;
create policy "field_surveys_allow_all"
  on field_surveys
  for all
  using (true)
  with check (true);
