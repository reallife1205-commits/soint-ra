-- "배정 현황" 카드에서 실제로 안건 하나하나(제목/담당자/기한)를 미리 리스트업해두는 용도.
-- year_case_targets(단순 배정 건수 숫자 하나)를 대체함 — 018을 이미 실행했다면 그대로 둬도
-- 무방하고(더 이상 코드에서 안 씀), 아직 실행 안 했다면 그건 건너뛰고 이 파일만 실행하면 됨.
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists pgcrypto;

create table if not exists assigned_cases (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  case_number text not null,
  company_name text,
  manager text,
  due_date date,
  created_at timestamptz not null default now()
);

alter table assigned_cases enable row level security;

drop policy if exists "assigned_cases_allow_all" on assigned_cases;
create policy "assigned_cases_allow_all"
  on assigned_cases
  for all
  using (true)
  with check (true);
